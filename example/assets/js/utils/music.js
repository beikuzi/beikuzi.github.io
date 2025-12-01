/**
 * 音乐播放器 - 支持封面提取、shuffle、预加载等功能
 */

import { qs, qsa, loadScript } from './utils.js';

// ============================================
// 全局状态变量
// ============================================
let audio = null;
let playMode = 'loop'; // 'loop', 'single', 'shuffle'
let playlist = [];
let currentIndex = 0;
let isLoaded = false;
let shuffleOrder = [];
let shuffleCursor = 0;
let preloader = null;
let nowCoverToken = 0;
let nowCoverTimer = null;
let progressRAF = null;
let isSeeking = false;
let seekRetryCount = 0;
const MAX_SEEK_RETRIES = 3;

const coverCache = new Map();
const coverFileCache = new Map();
const coverPending = new Map();
const fileCheckPending = new Map();
let marqueeObserverAttached = false;

// ============================================
// 封面提取功能
// ============================================

// 加载 jsmediatags 库
const ensureMetaLib = async () => {
  const cdnUrl = 'https://cdnjs.cloudflare.com/ajax/libs/jsmediatags/3.9.5/jsmediatags.min.js';
  await loadScript(cdnUrl);
};

// 获取音频文件封面
export const getCoverFor = async (src, fallback = true) => {
  try {
    const abs = new URL(src, location.href).href;
    if (coverCache.has(abs)) return coverCache.get(abs);
    if (coverPending.has(abs)) return await coverPending.get(abs);

    const task = (async () => {
      const fileUrl = await tryCoverFromFolder(abs);
      if (fileUrl) {
        coverCache.set(abs, fileUrl);
        return fileUrl;
      }
      if (!fallback) return null;
      await ensureMetaLib();
      return await new Promise((resolve) => {
        new window.jsmediatags.Reader(abs).setTagsToRead(['picture']).read({
          onSuccess: (tag) => {
            const p = tag.tags && tag.tags.picture;
            if (!p) return resolve(null);
            let s = '';
            const d = p.data || [];
            for (let i = 0; i < d.length; i++) {
              s += String.fromCharCode(d[i]);
            }
            const url = `data:${p.format};base64,${btoa(s)}`;
            coverCache.set(abs, url);
            resolve(url);
          },
          onError: () => resolve(null)
        });
      });
    })();

    coverPending.set(abs, task);
    const result = await task;
    coverPending.delete(abs);
    return result;
  } catch (e) {
    console.warn('[Music] 封面提取失败:', e);
    return null;
  }
};

const tryCoverFromFolder = async (src) => {
  try {
    const name = decodeURIComponent(src).split('/').pop().replace(/\.[^.]+$/, '');
    const exts = ['jpg','png','webp'];
    for (let i = 0; i < exts.length; i++) {
      const u = new URL(`../assets/covers/${name}.${exts[i]}`, location.href).href;
      if (coverFileCache.has(u)) {
        if (coverFileCache.get(u)) return u;
        continue;
      }
      if (fileCheckPending.has(u)) {
        const ok = await fileCheckPending.get(u);
        coverFileCache.set(u, !!ok);
        if (ok) return u;
        continue;
      }
      const headTask = (async () => {
        try {
          const r = await fetch(u, { method: 'HEAD' });
          return !!(r && r.ok);
        } catch (_) {
          return false;
        }
      })();
      fileCheckPending.set(u, headTask);
      const ok = await headTask;
      fileCheckPending.delete(u);
      coverFileCache.set(u, ok);
      if (ok) return u;
    }
  } catch (_) {}
  return null;
};

// ============================================
// 音频对象初始化
// ============================================

const initAudio = () => {
  if (audio) return;
  
  audio = new Audio();
  audio.loop = false;
  audio.preload = 'metadata';
  audio.playbackRate = 1.15;
  audio.volume = 0.6;
  audio.crossOrigin = 'anonymous';
  
  // 播放事件
  audio.addEventListener('play', () => {
    const musicBtn = qs('.music-btn');
    const playBtn = qs('.mc-play');
    if (musicBtn) musicBtn.classList.add('playing');
    if (playBtn) playBtn.textContent = '⏸';
    
    // 使用 RAF 平滑更新进度
    if (progressRAF) cancelAnimationFrame(progressRAF);
    
    const updateLoop = () => {
      const progress = qs('.mc-progress');
      if (progress && audio && !audio.paused && !isSeeking) {
        const d = audio.duration;
        if (Number.isFinite(d) && d > 0) {
          const percent = (audio.currentTime / d) * 100;
          progress.value = String(Math.floor(percent));
        }
      }
      
      if (audio && !audio.paused) {
        progressRAF = requestAnimationFrame(updateLoop);
      } else {
        progressRAF = null;
      }
    };
    
    updateLoop();

    const pop = qs('#music-pop');
    const el = pop ? pop.querySelector('.music-item.active .mc-title') : null;
    if (pop && pop.classList.contains('show') && el) {
      const btn = el.closest('.music-item');
      startMarquee(el, btn);
    }
  });
  
  // 暂停事件
  audio.addEventListener('pause', () => {
    const musicBtn = qs('.music-btn');
    const playBtn = qs('.mc-play');
    if (musicBtn) musicBtn.classList.remove('playing');
    if (playBtn) playBtn.textContent = '▶';
    
    if (progressRAF) {
      cancelAnimationFrame(progressRAF);
      progressRAF = null;
    }

    const pop = qs('#music-pop');
    const el = pop ? pop.querySelector('.music-item.active .mc-title') : null;
    if (pop && el) {
      stopMarquee(el);
    }
  });
  
  // Seeking 开始 - 设置标志防止进度被覆盖
  audio.addEventListener('seeking', () => {
    isSeeking = true;
  });
  
  // Seeking 完成 - 重置标志并更新进度
  audio.addEventListener('seeked', () => {
    isSeeking = false;
    seekRetryCount = 0;
    
    const progress = qs('.mc-progress');
    if (progress) {
      const d = audio.duration;
      if (Number.isFinite(d) && d > 0) {
        const percent = (audio.currentTime / d) * 100;
        progress.value = String(Math.floor(percent));
      }
    }
  });
  
  // 备用进度更新（RAF 未运行时）
  audio.addEventListener('timeupdate', () => {
    if (isSeeking) return; // 拖动时跳过
    
    const progress = qs('.mc-progress');
    if (progress && !progressRAF) {
      const d = audio.duration;
      if (Number.isFinite(d) && d > 0) {
        const percent = (audio.currentTime / d) * 100;
        progress.value = String(Math.floor(percent));
      }
    }
  });
  
  // 元数据加载完成
  audio.addEventListener('loadedmetadata', () => {
    const progress = qs('.mc-progress');
    if (progress) progress.value = '0';
  });
  
  // 播放结束
  audio.addEventListener('ended', handleEnded);
  
  // VBR 文件 seek 错误处理
  audio.addEventListener('error', (e) => {
    if (isSeeking && seekRetryCount < MAX_SEEK_RETRIES) {
      console.warn('[Music] Seek error, retrying...', e);
      seekRetryCount++;
      // 小幅调整目标时间重试
      const currentTarget = audio.currentTime;
      setTimeout(() => {
        if (audio) {
          audio.currentTime = currentTarget + 0.1;
        }
      }, 100);
    }
  });

  const progress = qs('.mc-progress');
  if (progress) {
    // 进度条交互在应用主入口处理，避免重复绑定
  }
};

// ============================================
// 播放控制
// ============================================

// 播放结束处理
const handleEnded = () => {
  const progress = qs('.mc-progress');
  if (progress) progress.value = '0';
  
  if (playMode === 'loop' || playMode === 'shuffle') {
    playNext();
  }
};

// 播放指定曲目
export const play = (index = 0) => {
  initAudio();
  buildPlaylist();
  
  if (!playlist.length) return;
  
  currentIndex = index;
  audio.loop = (playMode === 'single');
  audio.src = srcAbs(playlist[currentIndex].src);
  
  // 标记当前播放项
  qsa('#music-pop .music-item').forEach(x => x.classList.remove('active'));
  playlist[currentIndex].element.classList.add('active');
  
  // 异步展示封面（短暂显示后隐藏）
  (async () => {
    const coverBox = qs('.music-cover');
    const coverImg = coverBox ? coverBox.querySelector('img') : null;
    if (!coverBox || !coverImg) return;
    
    const token = ++nowCoverToken;
    const url = await getCoverFor(audio.src, true);
    
    if (token !== nowCoverToken) return;
    
    if (url) {
      if (coverImg.dataset.src !== url) {
        coverImg.src = url;
        coverImg.dataset.src = url;
      }
      coverBox.classList.add('show');
      
      if (nowCoverTimer) clearTimeout(nowCoverTimer);
      nowCoverTimer = setTimeout(() => {
        if (token !== nowCoverToken) return;
        coverBox.classList.remove('show');
      }, 1000);
    } else {
      coverBox.classList.remove('show');
    }
  })();
  
  schedulePreload();
  audio.play();
};

// 播放/暂停切换
export const togglePlay = () => {
  initAudio();
  
  if (audio.src) {
    if (audio.paused) {
      audio.play();
    } else {
      audio.pause();
    }
  } else {
    play(0);
  }
};

// 暂停播放
export const pause = () => {
  initAudio();
  if (audio && !audio.paused) {
    audio.pause();
  }
};

// 恢复播放
export const resume = () => {
  initAudio();
  if (audio && audio.src && audio.paused) {
    audio.play();
  }
};

// 播放下一首
export const playNext = () => {
  if (!playlist.length) return;
  
  if (playMode === 'shuffle') {
    const idx = nextFromShuffle();
    if (idx >= 0) {
      play(idx);
    } else {
      play((currentIndex + 1) % playlist.length);
    }
  } else {
    const nextIndex = (currentIndex + 1) % playlist.length;
    play(nextIndex);
  }
  
  schedulePreload();
};

// 播放上一首
export const playPrev = () => {
  if (!playlist.length) return;
  
  if (playMode === 'shuffle') {
    const idx = prevFromShuffle();
    if (idx >= 0) {
      play(idx);
    } else {
      play((currentIndex - 1 + playlist.length) % playlist.length);
    }
  } else {
    const prevIndex = (currentIndex - 1 + playlist.length) % playlist.length;
    play(prevIndex);
  }
  
  schedulePreload();
};

// ============================================
// 播放列表管理
// ============================================

// 加载音乐列表
export const loadMusicList = async () => {
  if (isLoaded) return;
  
  try {
    let baseDir = '../assets/music_m4a/';
    let response = null;
    try {
      response = await fetch(baseDir, { cache: 'no-store' });
    } catch (_) {}
    if (!response || !response.ok) {
      baseDir = '../assets/music/';
      response = await fetch(baseDir, { cache: 'no-store' });
      if (!response.ok) return [];
    }
    
    const html = await response.text();
    const div = document.createElement('div');
    div.innerHTML = html;
    
    // 提取音频文件链接
    let links = [...div.querySelectorAll('a')]
      .map(a => a.getAttribute('href'))
      .filter(href => href && /\.(m4a|mp3|ogg|wav)$/i.test(href));
    
    // 去重（使用绝对路径）
    const seen = new Set();
    links = links.filter(href => {
      const raw = /^(https?:|\/)/. test(href) ? href : `${baseDir}${href}`;
      let abs = raw;
      try {
        abs = new URL(raw, location.href).href;
      } catch (e) {}
      
      if (seen.has(abs)) return false;
      seen.add(abs);
      return true;
    });
    
    // 生成播放列表 UI
    const musicPop = qs('#music-pop');
  if (musicPop) {
    musicPop.querySelectorAll('.music-item').forEach(x => x.remove());
    
    links.forEach((href, i) => {
        const name = decodeURIComponent(href).split('/').pop()
          .replace(/\.[^.]+$/, '');
        const raw = /^(https?:|\/)/. test(href) ? href : `${baseDir}${href}`;
        let src = raw;
        try {
          src = new URL(raw, location.href).href;
        } catch (e) {}
        
        const button = document.createElement('button');
        button.className = 'music-item';
        const title = document.createElement('span');
        title.className = 'mc-title';
        title.textContent = name;
        title.style.display = 'inline-block';
        title.style.overflow = 'hidden';
        button.appendChild(title);
        button.setAttribute('data-src', src);
        button.addEventListener('click', () => {
          play(i);
        });
        button.addEventListener('mouseenter', () => {
          const coverBox = qs('.music-cover');
          const coverImg = coverBox ? coverBox.querySelector('img') : null;
          if (!coverBox || !coverImg) return;
          const token = ++nowCoverToken;
          const s = button.getAttribute('data-src');
          (async () => {
            const url = await getCoverFor(s, false);
            if (token !== nowCoverToken) return;
            if (url) {
              if (coverImg.dataset.src !== url) {
                coverImg.src = url;
                coverImg.dataset.src = url;
              }
              coverBox.classList.add('show');
            } else {
              coverBox.classList.remove('show');
            }
          })();
          startMarquee(title, button);
        });
        button.addEventListener('mouseleave', () => {
          const coverBox = qs('.music-cover');
          if (coverBox) {
            nowCoverToken++;
            coverBox.classList.remove('show');
          }
          stopMarquee(title);
        });
        musicPop.appendChild(button);
      });

      if (!marqueeObserverAttached) {
        try {
          const observer = new MutationObserver(() => {
            const shown = musicPop.classList.contains('show');
            const active = musicPop.querySelector('.music-item.active .mc-title');
            if (shown && active) {
              const btn = active.closest('.music-item');
              startMarquee(active, btn);
            } else if (active) {
              stopMarquee(active);
            }
          });
          observer.observe(musicPop, { attributes: true, attributeFilter: ['class'] });
          marqueeObserverAttached = true;
        } catch (_) {}
      }
    }
    
    isLoaded = true;
  } catch (error) {
    console.error('[Music] 加载音乐列表失败:', error);
  }
};

let marqueeRAF = new WeakMap();
let marqueeText = new WeakMap();
const startMarquee = (el, container) => {
  if (!el) return;
  let w = el.clientWidth;
  if (container) {
    try {
      const cs = getComputedStyle(container);
      const pad = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
      const cw = container.clientWidth - pad;
      if (cw > 0) {
        el.style.width = `${cw}px`;
        w = cw;
      }
    } catch (_) {}
  }
  const sw = el.scrollWidth;
  if (sw <= w + 2) return;
  if (marqueeRAF.get(el)) return;
  const orig = el.textContent || '';
  marqueeText.set(el, orig);
  el.textContent = '';
  const s1 = document.createElement('span');
  const s2 = document.createElement('span');
  s1.textContent = orig + '   ';
  s2.textContent = orig + '   ';
  [s1, s2].forEach(s => { s.style.display = 'inline-block'; s.style.whiteSpace = 'nowrap'; });
  el.appendChild(s1);
  el.appendChild(s2);
  let x = 0;
  let w1 = s1.offsetWidth;
  const speed = Math.max(0.5, Math.min(2.0, w1 / 300));
  const loop = () => {
    x -= speed;
    if (-x >= w1) x += w1;
    s1.style.transform = `translateX(${x}px)`;
    s2.style.transform = `translateX(${x + w1}px)`;
    const id = requestAnimationFrame(loop);
    marqueeRAF.set(el, id);
  };
  loop();
};
const stopMarquee = (el) => {
  if (!el) return;
  const id = marqueeRAF.get(el);
  if (id) cancelAnimationFrame(id);
  marqueeRAF.delete(el);
  const orig = marqueeText.get(el);
  marqueeText.delete(el);
  if (typeof orig === 'string') el.textContent = orig;
  try { el.style.width = ''; } catch (_) {}
};

// 构建播放列表
const buildPlaylist = () => {
  const items = qsa('#music-pop .music-item');
  playlist = [...items].map(item => ({
    src: srcAbs(item.getAttribute('data-src')),
    element: item
  }));
};

// ============================================
// Shuffle 模式
// ============================================

// 构建随机播放顺序
const buildShuffleOrder = (start) => {
  const n = playlist.length;
  if (!n) {
    shuffleOrder = [];
    shuffleCursor = 0;
    return;
  }
  
  const rest = [];
  for (let i = 0; i < n; i++) {
    if (i !== start) rest.push(i);
  }
  
  // Fisher-Yates 洗牌算法
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  
  shuffleOrder = [start, ...rest];
  shuffleCursor = 0;
};

// 验证 shuffle 顺序有效性
const validateShuffle = () => {
  if (!Array.isArray(shuffleOrder)) return false;
  if (shuffleOrder.length !== playlist.length) return false;
  
  const s = new Set(shuffleOrder);
  if (s.size !== playlist.length) return false;
  
  for (const idx of shuffleOrder) {
    if (typeof idx !== 'number' || idx < 0 || idx >= playlist.length) {
      return false;
    }
  }
  
  return true;
};

// 获取下一首（shuffle 模式）
const nextFromShuffle = () => {
  if (playMode !== 'shuffle') return -1;
  
  const cur = indexBySrc(audio ? audio.src : '');
  if (!validateShuffle()) {
    buildShuffleOrder(cur >= 0 ? cur : 0);
  }
  
  if (typeof shuffleCursor !== 'number') shuffleCursor = 0;
  
  let nextIdx = shuffleOrder[shuffleCursor + 1];
  if (nextIdx === undefined) {
    buildShuffleOrder(cur >= 0 ? cur : 0);
    nextIdx = shuffleOrder[shuffleCursor + 1];
  }
  
  shuffleCursor++;
  return typeof nextIdx === 'number' ? nextIdx : -1;
};

// 获取上一首（shuffle 模式）
const prevFromShuffle = () => {
  if (playMode !== 'shuffle') return -1;
  
  const cur = indexBySrc(audio ? audio.src : '');
  if (!validateShuffle()) {
    buildShuffleOrder(cur >= 0 ? cur : 0);
  }
  
  if (typeof shuffleCursor !== 'number') shuffleCursor = 0;
  
  if (shuffleCursor <= 0) {
    shuffleCursor = shuffleOrder.length - 1;
  } else {
    shuffleCursor -= 1;
  }
  
  const prevIdx = shuffleOrder[shuffleCursor];
  return typeof prevIdx === 'number' ? prevIdx : -1;
};

// Shuffle 模式启动
export const startShuffleFrom = (index = 0) => {
  initAudio();
  buildPlaylist();
  if (!playlist.length) return;
  
  currentIndex = index;
  playMode = 'shuffle';
  audio.loop = false;
  buildShuffleOrder(currentIndex);
  shuffleCursor = 0;
  audio.src = srcAbs(playlist[currentIndex].src);
  
  qsa('#music-pop .music-item').forEach(x => x.classList.remove('active'));
  playlist[currentIndex].element.classList.add('active');
  
  schedulePreload();
  audio.play();
};

// ============================================
// 预加载
// ============================================

// 预测下一首歌曲索引
const peekNextIndex = () => {
  if (!playlist.length) return -1;
  
  if (playMode === 'shuffle') {
    const cur = indexBySrc(audio ? audio.src : '');
    if (!Array.isArray(shuffleOrder) || shuffleOrder.length !== playlist.length) {
      buildShuffleOrder(cur >= 0 ? cur : 0);
    }
    const idx = shuffleOrder[(shuffleCursor + 1) % shuffleOrder.length];
    return typeof idx === 'number' ? idx : -1;
  }
  
  return (currentIndex + 1) % playlist.length;
};

// 预加载下一首
const schedulePreload = () => {
  const idx = peekNextIndex();
  if (idx < 0 || !playlist[idx]) return;
  
  if (!preloader) {
    preloader = new Audio();
    preloader.preload = 'metadata';
    preloader.crossOrigin = 'anonymous';
    preloader.volume = 0;
  }
  
  const target = playlist[idx].src;
  try {
    const abs = new URL(target, location.href).href;
    if (preloader.src !== abs) {
      preloader.src = abs;
      preloader.load();
    }
    try { getCoverFor(abs, false); } catch(_) {}
  } catch (e) {
    preloader.src = target;
    try {
      preloader.load();
    } catch (_) {}
  }
};

// ============================================
// 工具函数
// ============================================

// 转换为绝对路径
const srcAbs = (s) => {
  try {
    return new URL(s, location.href).href;
  } catch (e) {
    return s || '';
  }
};

// 根据 src 查找索引
const indexBySrc = (s) => {
  const a = srcAbs(s || '');
  return playlist.findIndex(it => srcAbs(it.src) === a);
};

// ============================================
// 设置接口
// ============================================

// 设置播放模式
export const setPlayMode = (mode) => {
  playMode = mode;
  if (audio) {
    audio.loop = (mode === 'single');
  }
  
  if (mode === 'shuffle') {
    buildPlaylist();
    const cur = indexBySrc(audio ? audio.src : playlist[currentIndex]?.src);
    buildShuffleOrder(cur >= 0 ? cur : currentIndex);
  }
  
  schedulePreload();
};

// 设置音量
export const setVolume = (volume) => {
  initAudio();
  audio.volume = Math.max(0, Math.min(1, volume));
};

// 设置进度（跳转到指定位置）
export const setProgress = (percent) => {
  initAudio();
  
  const d = audio.duration;
  let base = Number.isFinite(d) && d > 0 ? d : NaN;
  try {
    const sr = audio.seekable;
    if ((!Number.isFinite(base) || base <= 0) && sr && sr.length > 0) {
      base = sr.end(sr.length - 1);
    }
  } catch (_) {}
  if (!Number.isFinite(base) || base <= 0) {
    if (audio.readyState < 1) {
      const wait = () => {
        const dd = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : (audio.seekable && audio.seekable.length > 0 ? audio.seekable.end(audio.seekable.length - 1) : NaN);
        if (Number.isFinite(dd) && dd > 0) {
          const tt = dd * (percent / 100);
          try { audio.currentTime = tt; } catch (_) {}
        }
      };
      audio.addEventListener('loadedmetadata', wait, { once: true });
      audio.addEventListener('canplay', wait, { once: true });
    }
    return;
  }
  let targetTime = base * (percent / 100);
  if (!Number.isFinite(targetTime) || targetTime < 0) return;
  try {
    const sr = audio.seekable;
    if (sr && sr.length > 0) {
      const end = sr.end(sr.length - 1);
      if (Number.isFinite(end) && targetTime > end) {
        targetTime = Math.max(0, end - 0.05);
      }
    }
  } catch (_) {}
  isSeeking = true;
  seekRetryCount = 0;
  try {
    audio.currentTime = targetTime;
  } catch (_) {
    isSeeking = false;
  }
};

// 获取当前状态
export const getState = () => ({
  isPlaying: audio && !audio.paused,
  currentTime: audio ? audio.currentTime : 0,
  duration: audio ? audio.duration : 0,
  volume: audio ? audio.volume : 0.6,
  playMode,
  currentIndex
});

// 调试工具
export const debugPrint = () => {
  buildPlaylist();
  const list = playlist.map((p, i) => ({ i, src: srcAbs(p.src) }));
  
  console.group('🎵 Music Debug');
  console.table(list);
  console.log('shuffleOrder:', shuffleOrder);
  console.log('shuffleCursor:', shuffleCursor);
  console.log('currentIndex:', currentIndex);
  console.log('playMode:', playMode);
  console.groupEnd();
};