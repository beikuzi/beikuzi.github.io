/**
 * 应用主入口
 */

import { qs, qsa, toggleCat, loadScript } from './utils/utils.js';
import { loadConfig, applyConfig } from './config.js';
import * as Effects from './effects/effects-manager.js';
import * as Music from './utils/music.js';
import * as Live2D from './utils/live2d.js';
import * as UI from './ui.js';
import { initCover } from './utils/cover.js';
import * as PaginationStyles from './utils/pagination-styles.js';
import * as PageManager from './pages/page-manager.js';

// ============================================
// 初始化函数
// ============================================

const initEventListeners = () => {
  // 分类切换按钮
  qsa('.cat-toggle').forEach(button => {
    button.addEventListener('click', toggleCat);
  });
  
  // 全部展开/折叠按钮
  const collapseBtn = qs('.collapse-all');
  if (collapseBtn) {
    collapseBtn.addEventListener('click', () => {
      const allOpen = [...qsa('.cat')].every(x => 
        x.classList.contains('open')
      );
      if (allOpen) {
        qsa('.cat').forEach(c => c.classList.remove('open'));
      } else {
        qsa('.cat').forEach(c => c.classList.add('open'));
      }
    });
  }
  
  
  const toggleDark = qs('.toggle-dark');
  if (toggleDark) {
    toggleDark.addEventListener('click', UI.toggleDarkMode);
  }
  
  const effectsBtn = qs('.toggle-effects');
  if (effectsBtn) {
    let enabled = true;
    window.__effectsEnabled = true;
    const effectSelect = qs('#effect-select');
    const updateBtn = () => {
      effectsBtn.textContent = '✨';
      effectsBtn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
      effectsBtn.classList.toggle('on', enabled);
      effectsBtn.classList.toggle('off', !enabled);
    };
    updateBtn();
    effectsBtn.addEventListener('click', () => {
      enabled = !enabled;
      window.__effectsEnabled = enabled;
      if (!enabled) {
        Effects.disableAll();
        Effects.disableGradient();
        UI.setCardHoverEffect('none');
        if (effectSelect) effectSelect.disabled = true;
      } else {
        Effects.enableGradient();
        UI.setCardHoverEffect('lift');
        if (effectSelect) {
          effectSelect.disabled = false;
          const name = effectSelect.value;
          if (name && name !== 'none') {
            Effects.setEffect(name);
          } else {
            Effects.enableAllVisuals();
          }
        } else {
          const cur = Effects.getCurrentEffect();
          if (cur && cur !== 'none') {
            Effects.setEffect(cur);
          } else {
            Effects.enableAllVisuals();
          }
        }
      }
      updateBtn();
    });
  }
  
  // Live2D 切换
  const toggleLive2D = qs('#toggle-live2d');
  if (toggleLive2D) {
    toggleLive2D.addEventListener('change', (e) => {
      if (e.target.checked) {
        Live2D.enable();
      } else {
        Live2D.disable();
      }
    });
  }
  
  // 特效选择
  const effectSelect = qs('#effect-select');
  if (effectSelect) {
    effectSelect.addEventListener('change', (e) => {
      Effects.disableAll();
      Effects.setEffect(e.target.value);
    });
  }
  
  // 翻页样式选择
  const paginationStyleSelect = qs('#pagination-style-select');
  if (paginationStyleSelect) {
    // 不在这里初始化样式，等 applyStartupConfig() 完成后再初始化
    // 这样可以避免重复应用样式导致的闪烁
    
    // 监听样式切换
    paginationStyleSelect.addEventListener('change', (e) => {
      PaginationStyles.setPaginationStyle(e.target.value);
    });
  }
  
  // 侧边栏按钮
  const sidebarBtn = qs('.toggle-sidebar');
  if (sidebarBtn) {
    sidebarBtn.addEventListener('click', UI.toggleSidebar);
  }
  
  // 侧边栏边缘按钮
  const edgeBtn = qs('.sidebar-edge');
  if (edgeBtn) {
    edgeBtn.addEventListener('click', UI.toggleSidebar);
  }
  
  // 音乐按钮（多个实例：外部打开按钮 + 控件行内按钮）
  const musicBtns = qsa('.music-btn');
  const musicPop = qs('#music-pop');
  if (musicBtns.length && musicPop) {
    musicBtns.forEach(musicBtn => {
      musicBtn.addEventListener('click', async () => {
        // 先显示弹窗，然后在后台加载列表（如果还没加载）
        musicPop.classList.toggle('show');
        const wrap = qs('.music-wrap');
        if (wrap) wrap.classList.toggle('open');
        // 如果列表还没加载，在后台加载（不阻塞UI）
        Music.loadMusicList().catch(err => {
          console.warn('[Music] 加载音乐列表失败:', err);
        });
      });
    });
  
    // 委托播放点击
    musicPop.addEventListener('click', (e) => {
      const item = e.target.closest('.music-item');
      if (!item) return;
      const items = [...qsa('#music-pop .music-item')];
      const index = items.indexOf(item);
      if (index >= 0) {
        const mode = Music.getState().playMode;
        if (mode === 'shuffle') {
          Music.startShuffleFrom(index);
        } else {
          Music.play(index);
        }
        Music.debugPrint();
      }
    });

    const coverBox = qs('.music-cover');
    const coverImg = coverBox ? coverBox.querySelector('img') : null;
    let coverAllowed = false;
    let coverToken = 0;
    let hoverTimer = null;

    musicPop.addEventListener('mouseover', (e) => {
      const item = e.target.closest('.music-item');
      if (!item || !coverImg || !coverBox) return;
      const src = item.getAttribute('data-src') || '';
      coverAllowed = true;
      const token = ++coverToken;
      if (hoverTimer) clearTimeout(hoverTimer);
      hoverTimer = setTimeout(async () => {
        const url = await Music.getCoverFor(src, false);
        if (!coverAllowed || token !== coverToken) return;
        if (url) {
          if (coverImg.dataset.src !== url) {
            coverImg.src = url;
            coverImg.dataset.src = url;
          }
          coverBox.classList.add('show');
        } else {
          coverBox.classList.remove('show');
        }
      }, 150);
    });
    musicPop.addEventListener('mouseleave', () => {
      coverAllowed = false;
      coverToken++;
      if (coverBox) coverBox.classList.remove('show');
    });

    ['.mc-play', '.mc-prev', '.mc-next', '.mc-mode', '.mc-volume', '.music-btn'].forEach(sel => {
      const els = qsa(sel);
      if (!els.length) return;
      const hide = () => {
        const hold = Number(document.body.dataset.coverHold || 0);
        if (Date.now() < hold) return;
        coverAllowed = false;
        coverToken++;
        if (coverBox) coverBox.classList.remove('show');
      };
      els.forEach(el => {
        el.addEventListener('mouseenter', hide);
        el.addEventListener('focus', hide);
      });
    });
  }

  // 点击外部区域时收起音乐弹层与音量弹层
  document.addEventListener('click', (e) => {
    const wrap = qs('.music-wrap');
    const vpop = qs('.mc-volume-pop');
    if (musicPop && musicPop.classList.contains('show') && wrap && !wrap.contains(e.target)) {
      musicPop.classList.remove('show');
      wrap.classList.remove('open');
    }
    if (vpop && wrap && !wrap.contains(e.target)) {
      vpop.classList.remove('show');
      wrap.classList.remove('open');
    }
  });
  // Esc 键收起
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && musicPop && musicPop.classList.contains('show')) {
      musicPop.classList.remove('show');
      const wrap = qs('.music-wrap');
      if (wrap) wrap.classList.remove('open');
    }
  });
  
  // 播放控制
  const playBtn = qs('.mc-play');
  if (playBtn) {
    playBtn.addEventListener('click', Music.togglePlay);
  }
  
  const prevBtn = qs('.mc-prev');
  if (prevBtn) {
    prevBtn.addEventListener('click', Music.playPrev);
  }
  
  const nextBtn = qs('.mc-next');
  if (nextBtn) {
    nextBtn.addEventListener('click', Music.playNext);
  }
  
  // 进度条
  const progress = qs('.mc-progress');
  if (progress) {
    progress.addEventListener('input', () => {
      const value = parseInt(progress.value) || 0;
      Music.setProgress(value);
    });
    progress.addEventListener('change', () => {
      const value = parseInt(progress.value) || 0;
      Music.setProgress(value);
    });

    let tip = null;
    let rafId = null;
    const fmt = (t) => {
      if (!Number.isFinite(t) || t < 0) return '00:00';
      const m = Math.floor(t / 60);
      const s = Math.floor(t % 60);
      return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    };
    const ensureTip = () => {
      if (!tip) {
        tip = document.createElement('div');
        tip.className = 'mc-progress-tip';
        const ctrl = qs('.music-ctrl');
        if (ctrl) ctrl.appendChild(tip);
      }
    };
    const updateTip = (x) => {
      const state = Music.getState();
      const text = `${fmt(state.currentTime)} / ${fmt(state.duration)}`;
      tip.textContent = text;
      const rect = progress.getBoundingClientRect();
      const rel = Math.max(0, Math.min(rect.width, x - rect.left));
      const ctrlRect = qs('.music-ctrl').getBoundingClientRect();
      const tipWidth = tip.offsetWidth;
      const tipHalfWidth = tipWidth / 2;
      
      // 计算光标在进度条内的相对位置
      const progressX = Math.max(0, Math.min(rect.width, x - rect.left));
      
      // 计算理想的 left 值（让光标在提示框中间）
      let newLeft = progressX - tipHalfWidth;
      
      // 边界检查：确保提示框不会超出 music-ctrl 的范围
      if (newLeft < 0) {
        newLeft = 0;
      }
      if (newLeft + tipWidth > ctrlRect.width) {
        newLeft = ctrlRect.width - tipWidth;
      }
      
      tip.style.left = `${newLeft}px`;
      tip.style.display = 'block';
    };
    const loop = () => {
      const state = Music.getState();
      const rect = progress.getBoundingClientRect();
      const x = rect.left + rect.width * ((parseInt(progress.value)||0)/100);
      updateTip(x);
      rafId = requestAnimationFrame(loop);
    };
    progress.addEventListener('mouseenter', (e) => {
      ensureTip();
      updateTip(e.clientX);
      if (!rafId) rafId = requestAnimationFrame(loop);
    });
    progress.addEventListener('mousemove', (e) => {
      if (!tip) return;
      updateTip(e.clientX);
    });
    progress.addEventListener('mouseleave', () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
      if (tip) tip.style.display = 'none';
    });
  }
  
  const volBtn = qs('.mc-volume');
  const volPop = qs('.mc-volume-pop');
  const wrap = qs('.music-wrap');
  if (volBtn && volPop) {
    let hideTimer = null;
    let insidePop = false;
    let draggingVol = false;
    const showPop = () => {
      if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
      volPop.classList.add('show');
      volPop.style.position = 'fixed';
      volPop.style.visibility = 'hidden';
      volPop.style.transform = 'none';
      const br = volBtn.getBoundingClientRect();
      const pad = 14;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const pw = volPop.offsetWidth || 44;
      const ph = volPop.offsetHeight || 120;
      let left = br.left - pw - pad; // 默认显示在按钮左侧
      let top = br.top + br.height / 2 - ph / 2;
      // 若左侧不够空间，则显示在右侧
      if (left < pad) {
        left = br.right + pad;
      }
      if (left < pad) {
        left = Math.max(pad, br.left + br.width / 2 - pw / 2);
      }
      if (top < pad) top = pad;
      if (top + ph > vh - pad) top = vh - ph - pad;
      volPop.style.left = `${Math.round(left)}px`;
      volPop.style.top = `${Math.round(top)}px`;
      volPop.style.right = 'auto';
      volPop.style.visibility = '';

      // 立即显示当前音量
      const volTextNow = qs('.mc-vol-text');
      if (volTextNow) {
        const state = Music.getState();
        const pct = Math.round((state.volume || 0.6) * 100);
        volTextNow.textContent = `${pct}`;
      }
    };
    const scheduleHide = () => {
      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = setTimeout(() => {
        if (!insidePop && !draggingVol) {
          volPop.classList.remove('show');
        }
      }, 160);
    };
    volBtn.addEventListener('mouseenter', showPop);
    volBtn.addEventListener('focus', showPop);
    volBtn.addEventListener('mouseleave', scheduleHide);
    volPop.addEventListener('mouseenter', () => {
      insidePop = true;
      if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    });
    volPop.addEventListener('mouseleave', () => {
      insidePop = false;
      scheduleHide();
    });
    const volSliderEl = qs('.mc-vol-vert');
    if (volSliderEl) {
      const applyVolFromY = (y) => {
        const rect = volSliderEl.getBoundingClientRect();
        // 修复拖动方向：向上拖动减小音量，向下拖动增大音量
        // 因为滑块是垂直的，我们需要反转逻辑
        const ratio = 1 - (y - rect.top) / rect.height;
        const pct = Math.round(Math.max(0, Math.min(1, ratio)) * 100);
        volSliderEl.value = String(pct);
        Music.setVolume(pct / 100);
        const volText = qs('.mc-vol-text');
        if (volText) volText.textContent = `${pct}`;
      };
      
      // 阻止默认的滑块行为，使用自定义拖动
      volSliderEl.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
      
      volSliderEl.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        draggingVol = true;
        insidePop = true;
        try { volSliderEl.setPointerCapture(e.pointerId); } catch (_) {}
        applyVolFromY(e.clientY);
      });
      
      volSliderEl.addEventListener('pointermove', (e) => {
        if (!draggingVol) return;
        e.preventDefault();
        e.stopPropagation();
        applyVolFromY(e.clientY);
      });
      
      volSliderEl.addEventListener('pointerup', (e) => {
        draggingVol = false;
        try { volSliderEl.releasePointerCapture(e.pointerId); } catch (_) {}
        scheduleHide();
      });
      
      // 触摸兼容
      volSliderEl.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        draggingVol = true;
        insidePop = true;
        const t = e.touches[0];
        if (t) applyVolFromY(t.clientY);
      }, { passive: false });
      
      volSliderEl.addEventListener('touchmove', (e) => {
        if (!draggingVol) return;
        e.preventDefault();
        e.stopPropagation();
        const t = e.touches[0];
        if (t) applyVolFromY(t.clientY);
      }, { passive: false });
      
      volSliderEl.addEventListener('touchend', (e) => {
        e.preventDefault();
        draggingVol = false;
        scheduleHide();
      });
      
      volSliderEl.style.touchAction = 'none';

      volSliderEl.addEventListener('wheel', (e) => {
        e.preventDefault();
        e.stopPropagation();
        let pct = parseInt(volSliderEl.value) || 0;
        const step = e.ctrlKey ? 10 : 4;
        if (e.deltaY < 0) pct += step; else pct -= step;
        pct = Math.max(0, Math.min(100, pct));
        volSliderEl.value = String(pct);
        Music.setVolume(pct / 100);
        const volText = qs('.mc-vol-text');
        if (volText) volText.textContent = `${pct}`;
      });

      volPop.addEventListener('wheel', (e) => {
        e.preventDefault();
        e.stopPropagation();
        let pct = parseInt(volSliderEl.value) || Math.round((Music.getState().volume || 0) * 100) || 0;
        const step = e.ctrlKey ? 10 : 4;
        if (e.deltaY < 0) pct += step; else pct -= step;
        pct = Math.max(0, Math.min(100, pct));
        volSliderEl.value = String(pct);
        Music.setVolume(pct / 100);
        const volText = qs('.mc-vol-text');
        if (volText) volText.textContent = `${pct}`;
      });
    }
    
    // 悬浮即显示当前音量
    volSliderEl.addEventListener('mouseenter', () => {
      const volText = qs('.mc-vol-text');
      if (volText) {
        const state = Music.getState();
        const pct = Math.round((state.volume || 0.6) * 100);
        volText.textContent = `${pct}`;
      }
    });
  }
  
  // 音量控制
  const volSlider = qs('.mc-vol-vert');
  if (volSlider) {
    volSlider.addEventListener('input', () => {
      const value = (parseInt(volSlider.value) || 60) / 100;
      Music.setVolume(value);
      const volText = qs('.mc-vol-text');
      if (volText) volText.textContent = `${Math.round(value * 100)}`;
    });
  }
  
  // 播放模式切换
  const modeBtn = qs('.mc-mode');
  if (modeBtn) {
    modeBtn.addEventListener('click', () => {
      const modes = ['loop', 'shuffle', 'single'];
      const currentMode = Music.getState().playMode;
      const currentIndex = modes.indexOf(currentMode);
      const nextMode = modes[(currentIndex + 1) % modes.length];
      Music.setPlayMode(nextMode);
      
      // 更新按钮显示
      if (nextMode === 'loop') modeBtn.textContent = '🔁';
      else if (nextMode === 'shuffle') modeBtn.textContent = '🔀';
      else modeBtn.textContent = '1️⃣';
    });
  }

  // 失焦静音
  const muteBtn = qs('.mc-mute');
  let pausedByBlur = false;
  if (muteBtn) {
    muteBtn.addEventListener('click', () => {
      const on = muteBtn.classList.toggle('active');
      muteBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
  window.addEventListener('blur', () => {
    if (muteBtn && muteBtn.classList.contains('active') && Music.getState().isPlaying) {
      Music.pause();
      pausedByBlur = true;
    }
  });
  window.addEventListener('focus', () => {
    if (muteBtn && muteBtn.classList.contains('active') && pausedByBlur) {
      pausedByBlur = false;
      Music.resume();
    }
  });
};

// 应用启动配置
const applyStartupConfig = async () => {
  const config = await loadConfig();
  
  if (config) {
    applyConfig(config);
    
    // 应用默认特效
    if (config.defaultEffect) {
      const effectSelect = qs('#effect-select');
      if (config.defaultEffect === 'gradient') {
        Effects.enableGradient();
        if (effectSelect) effectSelect.value = 'none';
      } else {
        Effects.setEffect(config.defaultEffect);
        if (effectSelect) effectSelect.value = config.defaultEffect;
      }
    }
    
    // 应用暗色模式
    if (config.darkModeDefault) {
      document.body.classList.add('dark');
      const variant = config.darkThemeVariant || 'forest';
      UI.setDarkThemeVariant(variant);
    }
    
    // 应用 Live2D
    if (config.live2dDefault) {
      const toggle = qs('#toggle-live2d');
      if (toggle) {
        toggle.checked = true;
        Live2D.enable();
      }
    }
    
    // 应用翻页样式（配置文件优先级最高）
    if (config.paginationStyle) {
      PaginationStyles.setPaginationStyle(config.paginationStyle);
    } else {
      // 如果配置文件中没有指定，从 localStorage 读取或使用默认值
      PaginationStyles.initPaginationStyle();
    }
    
    // 控制翻页样式选择器的显示/隐藏
    const paginationStyleSelect = qs('#pagination-style-select');
    if (paginationStyleSelect) {
      if (config.paginationStyleSelector === false) {
        // 隐藏切换按钮
        paginationStyleSelect.style.display = 'none';
      } else {
        // 显示切换按钮
        paginationStyleSelect.style.display = '';
        paginationStyleSelect.value = PaginationStyles.getCurrentStyle();
      }
    }
  } else {
    // 如果没有配置文件，从 localStorage 读取或使用默认值
    PaginationStyles.initPaginationStyle();
    
    // 更新选择器的显示值
    const paginationStyleSelect = qs('#pagination-style-select');
    if (paginationStyleSelect) {
      paginationStyleSelect.value = PaginationStyles.getCurrentStyle();
    }
  }
};

// 主初始化函数
const init = async () => {
  // 初始化事件监听
  initEventListeners();
  
  // 初始化 UI 模块
  UI.initSidebarResize();
  UI.initGridLayout();
  UI.setCardHoverEffect('lift');
  UI.initAvatarPopover();
  UI.addDemoCards(48);
  
  // 先初始化翻页功能（必须在页面管理器之前）
  UI.initPagination();
  
  // 初始化页面管理器（必须在翻页功能初始化之后）
  // 这样页面管理器在切换页面时可以正确使用翻页功能
  PageManager.init();
  
  // 启用动效
  UI.enableRowFallEffect();
  
  // 启用背景渐变
  Effects.enableGradient();
  // const pg = qs('nav.tabs .pager');
  // if (pg) pg.classList.remove('pagination-loading');

  await initCover();
  
  // 加载并应用配置
  await applyStartupConfig();
  Effects.enableAllVisuals();
  const effectSelectInit = qs('#effect-select');
  if (effectSelectInit) effectSelectInit.value = 'none';
  
  // 预加载音乐列表（后台加载，不阻塞主流程）
  Music.loadMusicList().catch(err => {
    console.warn('[Music] 预加载音乐列表失败:', err);
  });
  
  console.log('✨ 应用初始化完成');
};

// ============================================
// 启动应用
// ============================================

// 立即设置正确的标签页激活状态（在 DOM 加载前就处理，避免闪烁）
(function() {
  try {
    var h = location.hash || '#home';
    if (h !== '#home') {
      // 使用 DOMContentLoaded 确保 DOM 已加载
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
          var tabs = document.querySelectorAll('nav.tabs a');
          if (tabs && tabs.length) {
            tabs.forEach(function(tab) {
              var href = tab.getAttribute('href') || '';
              tab.classList.toggle('active', href === h);
            });
          }
        });
      } else {
        // DOM 已经加载完成，立即设置
        var tabs = document.querySelectorAll('nav.tabs a');
        if (tabs && tabs.length) {
          tabs.forEach(function(tab) {
            var href = tab.getAttribute('href') || '';
            tab.classList.toggle('active', href === h);
          });
        }
      }
    }
  } catch (e) {
    console.warn('[Main] 设置标签页激活状态失败:', e);
  }
})();

// DOM 加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// 导出公共 API
export {
  Effects,
  Music,
  Live2D,
  UI
};
