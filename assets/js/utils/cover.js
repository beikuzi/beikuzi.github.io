import { qs } from './utils.js';
import { loadConfig } from '../config.js';

let prevSidebarOpen = false;
let videoPath = null;
let isInitialized = false; // 防止重复初始化
let savedVideoTime = 0; // 保存视频播放位置

const applyGuideStyle = (cfg) => {
  if (!cfg || !cfg.guide) return;
  const g = cfg.guide;
  if (typeof g.arrowWidth === 'number') document.documentElement.style.setProperty('--guide-arrow-width', `${g.arrowWidth}px`);
  if (typeof g.arrowHeight === 'number') document.documentElement.style.setProperty('--guide-arrow-height', `${g.arrowHeight}px`);
  if (typeof g.arrowThickness === 'number') document.documentElement.style.setProperty('--guide-arrow-thickness', `${g.arrowThickness}px`);
  if (typeof g.arrowGap === 'number') document.documentElement.style.setProperty('--guide-arrow-gap', `${g.arrowGap}px`);
};

const resolveSrc = (src) => {
  try {
    return new URL(src, location.href).href;
  } catch (e) {
    return src;
  }
};

const enterCover = () => {
  const hero = qs('#hero-cover');
  const vid = qs('#hero-video');
  const sidebar = qs('.sidebar');
  const edgeBtn = qs('.sidebar-edge');
  if (!hero || !vid) return;
  
  // 保存侧边栏状态
  prevSidebarOpen = sidebar ? sidebar.classList.contains('open') : false;
  
  // 添加封面模式
  document.body.classList.add('cover-mode');
  vid.muted = true;
  
  // 只在第一次进入时设置视频源，避免重复设置
  if (videoPath && !vid.src) {
    const abs = resolveSrc(videoPath);
    vid.src = abs;
  }
  
  // 恢复保存的播放位置的辅助函数
  const restoreVideoTime = () => {
    if (savedVideoTime > 0 && vid.duration && vid.duration > 0) {
      // 如果视频是循环播放，且保存的时间超过视频长度，取模
      const targetTime = vid.loop ? (savedVideoTime % vid.duration) : Math.min(savedVideoTime, vid.duration);
      vid.currentTime = targetTime;
    } else if (savedVideoTime > 0) {
      // 如果视频时长还未加载，先设置一个值，等loadedmetadata事件再调整
      vid.currentTime = savedVideoTime;
    }
  };
  
  // 优化：只在需要时加载视频，避免过早消耗GPU
  // 使用loadeddata事件确保视频元数据已加载
  const startPlayback = () => {
    if (vid.readyState >= 2) {
      // 视频数据已加载，恢复播放位置并播放
      restoreVideoTime();
      try { 
        vid.play().catch(e => console.warn('Video play failed:', e));
      } catch (e) {
        console.warn('Video play error:', e);
      }
    } else {
      // 等待视频元数据加载（获取duration）
      vid.addEventListener('loadedmetadata', () => {
        restoreVideoTime();
      }, { once: true });
      
      // 等待视频数据加载
      vid.addEventListener('loadeddata', () => {
        restoreVideoTime();
        try { 
          vid.play().catch(e => console.warn('Video play failed:', e));
        } catch (e) {
          console.warn('Video play error:', e);
        }
      }, { once: true });
      // 开始加载视频
      try { vid.load(); } catch (e) {}
    }
  };
  
  // 如果视频已经加载过，恢复位置并直接播放
  if (vid.readyState >= 3) {
    restoreVideoTime();
    try { vid.play().catch(e => console.warn('Video play failed:', e)); } catch (e) {}
  } else {
    startPlayback();
  }
  
  // 关闭侧边栏
  if (sidebar) sidebar.classList.remove('open');
  if (edgeBtn) edgeBtn.textContent = '›';
};

const leaveCover = () => {
  const vid = qs('#hero-video');
  const sidebar = qs('.sidebar');
  const edgeBtn = qs('.sidebar-edge');
  document.body.classList.remove('cover-mode');
  if (vid) { 
    try { 
      // 保存当前播放位置，只暂停不重置
      // 如果视频是循环播放，保存实际播放时间（可能超过duration）
      const currentTime = vid.currentTime || 0;
      const duration = vid.duration || 0;
      if (vid.loop && duration > 0 && currentTime >= duration) {
        // 循环播放时，保存完整的时间（包括循环次数）
        savedVideoTime = currentTime;
      } else {
        savedVideoTime = currentTime;
      }
      vid.pause(); 
    } catch (e) {} 
  }
  if (sidebar) sidebar.classList.toggle('open', prevSidebarOpen);
  if (edgeBtn) edgeBtn.textContent = prevSidebarOpen ? '‹' : '›';
};

export const initCover = async () => {
  // 防止重复初始化
  if (isInitialized) return;
  
  const cfg = await loadConfig();
  applyGuideStyle(cfg || {});
  if (cfg && cfg.coverVideo) videoPath = cfg.coverVideo;
  
  // 等待DOM完全加载
  const waitForElements = () => {
    const btn = qs('.guide-toggle');
    const exitBtn = qs('#cover-exit');
    const hero = qs('#hero-cover');
    const vid = qs('#hero-video');
    
    if (!btn || !hero || !vid) {
      // 如果元素还未加载，等待后重试
      setTimeout(waitForElements, 100);
      return;
    }
    
    // 绑定事件监听器
    if (btn) {
      btn.addEventListener('click', () => {
        if (document.body.classList.contains('cover-mode')) leaveCover();
        else enterCover();
      });
    }
    if (exitBtn) exitBtn.addEventListener('click', leaveCover);
    
    // 优化：页面隐藏时暂停视频，节省GPU资源
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && vid && !vid.paused) {
        vid.pause();
      } else if (!document.hidden && document.body.classList.contains('cover-mode') && vid && vid.paused) {
        vid.play().catch(e => console.warn('Video resume failed:', e));
      }
    });
    
    // 优化：窗口失焦时暂停视频
    window.addEventListener('blur', () => {
      if (vid && !vid.paused) {
        vid.pause();
      }
    });
    
    window.addEventListener('focus', () => {
      if (document.body.classList.contains('cover-mode') && vid && vid.paused) {
        vid.play().catch(e => console.warn('Video resume failed:', e));
      }
    });
    
    // 标记为已初始化
    isInitialized = true;
  };
  
  // 如果DOM还在加载中，等待加载完成
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForElements);
  } else {
    waitForElements();
  }
};