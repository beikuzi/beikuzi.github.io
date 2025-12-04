/**
 * 全局配置对象
 */

// 星轨特效配置
export const starConfig = {
  spawnIntervalMs: 40,        // 生成间隔（毫秒）
  spawnCount: 2,              // 每次生成数量
  initialAlpha: 0.95,         // 初始透明度
  alphaDecay: 0.96,           // 透明度衰减率
  radiusMin: 4,               // 最小半径
  radiusMax: 7,               // 最大半径
  radiusDecay: 0.995,         // 半径衰减率
  minAlphaThreshold: 0.04,    // 最小透明度阈值
  minRadiusThreshold: 1.2,    // 最小半径阈值
  velocityRange: 0.6,         // 速度范围
  zIndex: 10000               // 层级
};

// 涟漪特效配置
export const rippleConfig = {
  maxRadius: 160,             // 最大半径
  growSpeed: 3,               // 增长速度
  lineWidth: 4,               // 线条宽度
  alphaStart: 1,              // 起始透明度
  alphaDecay: 0.965,          // 透明度衰减率
  lineWidthDecay: 0.995,      // 线宽衰减率
  zIndex: 9999                // 层级
};

// 网格布局配置
export const gridConfig = {
  minRatio: 0.10,             // 最小间距比例
  maxRatio: 0.20,             // 最大间距比例
  gapPx: 36,                  // 间距（像素）
  minCols: 1,                 // 最小列数
  maxCols: 8                  // 最大列数
};

// 侧边栏配置
export const sidebarConfig = {
  defaultWidth: 280,          // 默认宽度
  minWidth: 160,              // 最小宽度
  maxWidth: 560               // 最大宽度
};

// 从配置文件加载设置
export const loadConfig = async () => {
  try {
    const response = await fetch('/config.json', { cache: 'no-store' });
    if (!response.ok) return null;
    
    const config = await response.json();
    return config;
  } catch (error) {
    console.warn('配置文件加载失败:', error);
    return null;
  }
};

// 应用配置到系统
export const applyConfig = (config) => {
  if (!config) return;
  
  // 应用星轨配置
  if (config.starTrail) {
    Object.assign(starConfig, config.starTrail);
  }
  
  // 应用涟漪配置
  if (config.clickRipple) {
    Object.assign(rippleConfig, config.clickRipple);
  }
  
  // 应用网格配置
  if (config.grid) {
    Object.assign(gridConfig, config.grid);
    if (config.grid.gapPx) {
      document.documentElement.style.setProperty('--grid-gap', `${config.grid.gapPx}px`);
    }
  }
  
  // 应用侧边栏宽度
  if (config.sidebarWidth) {
    const width = typeof config.sidebarWidth === 'number' 
      ? `${config.sidebarWidth}px` 
      : config.sidebarWidth;
    document.documentElement.style.setProperty('--sidebar-width', width);
    localStorage.setItem('sidebarWidth', width);
  }
  
  // 应用页面底部留白（支持对象格式，每个页面单独配置）
  if (config.pageBottomPadding !== undefined) {
    if (typeof config.pageBottomPadding === 'object') {
      // 存储配置供页面切换时使用
      window.__pageBottomPaddingConfig = config.pageBottomPadding;
      // 设置默认值
      const defaultPadding = config.pageBottomPadding.default || 200;
      const padding = typeof defaultPadding === 'number' ? `${defaultPadding}px` : defaultPadding;
      document.documentElement.style.setProperty('--page-bottom-padding', padding);
    } else {
      const padding = typeof config.pageBottomPadding === 'number' 
        ? `${config.pageBottomPadding}px` 
        : config.pageBottomPadding;
      document.documentElement.style.setProperty('--page-bottom-padding', padding);
    }
  }
  
  // 应用侧边栏间距配置
  if (config.sidebar) {
    if (config.sidebar.catMargin !== undefined) {
      document.documentElement.style.setProperty('--sidebar-cat-margin', config.sidebar.catMargin);
    }
    if (config.sidebar.itemMargin !== undefined) {
      document.documentElement.style.setProperty('--sidebar-item-margin', config.sidebar.itemMargin);
    }
    if (config.sidebar.contentBottomPadding !== undefined) {
      const padding = typeof config.sidebar.contentBottomPadding === 'number' 
        ? `${config.sidebar.contentBottomPadding}px` 
        : config.sidebar.contentBottomPadding;
      document.documentElement.style.setProperty('--sidebar-content-bottom-padding', padding);
    }
    if (config.sidebar.categoriesPadding !== undefined) {
      const padding = typeof config.sidebar.categoriesPadding === 'number' 
        ? `${config.sidebar.categoriesPadding}px` 
        : config.sidebar.categoriesPadding;
      document.documentElement.style.setProperty('--sidebar-categories-padding', padding);
    }
    if (config.sidebar.catTogglePadding !== undefined) {
      document.documentElement.style.setProperty('--sidebar-cat-toggle-padding', config.sidebar.catTogglePadding);
    }
    if (config.sidebar.itemPadding !== undefined) {
      document.documentElement.style.setProperty('--sidebar-item-padding', config.sidebar.itemPadding);
    }
    if (config.sidebar.itemIndent !== undefined) {
      document.documentElement.style.setProperty('--sidebar-item-indent', config.sidebar.itemIndent);
    }
    if (config.sidebar.catItemsGap !== undefined) {
      document.documentElement.style.setProperty('--sidebar-cat-items-gap', config.sidebar.catItemsGap);
    }
    if (config.sidebar.activeIndicatorLeft !== undefined) {
      const left = typeof config.sidebar.activeIndicatorLeft === 'number' 
        ? `${config.sidebar.activeIndicatorLeft}px` 
        : config.sidebar.activeIndicatorLeft;
      document.documentElement.style.setProperty('--sidebar-active-indicator-left', left);
    }
    
    // 动态计算底部按钮位置，确保内容在按钮上方结束
    updateSidebarBottomPadding();
  }

  // 音乐弹层尺寸
  if (config.musicPop) {
    const m = config.musicPop;
    if (m.width) {
      const v = typeof m.width === 'number' ? `${m.width}px` : m.width;
      document.documentElement.style.setProperty('--music-pop-width', v);
    }
    if (typeof m.visibleRows === 'number') {
      document.documentElement.style.setProperty('--music-pop-visible-rows', String(m.visibleRows));
    }
    if (typeof m.itemHeight === 'number') {
      document.documentElement.style.setProperty('--music-item-height', `${m.itemHeight}px`);
    }
  }

  // 音乐控制与进度尺寸
  if (config.musicUI) {
    const u = config.musicUI;
    if (typeof u.ctrlHeight === 'number') {
      document.documentElement.style.setProperty('--music-ctrl-height', `${u.ctrlHeight}px`);
    }
    if (typeof u.ctrlGap === 'number') {
      document.documentElement.style.setProperty('--music-ctrl-gap', `${u.ctrlGap}px`);
    }
    if (typeof u.progressHeight === 'number') {
      document.documentElement.style.setProperty('--music-progress-height', `${u.progressHeight}px`);
    }
    if (typeof u.volumeTrackWidth === 'number') {
      document.documentElement.style.setProperty('--volume-track-width', `${u.volumeTrackWidth}px`);
    }
    if (typeof u.volumeControlWidth === 'number') {
      document.documentElement.style.setProperty('--volume-control-width', `${u.volumeControlWidth}px`);
    }
  }

  // 独立音乐控制组件尺寸
  if (config.musicCtrl) {
    const c = config.musicCtrl;
    if (c.width) {
      const v = typeof c.width === 'number' ? `${c.width}px` : c.width;
      document.documentElement.style.setProperty('--music-ctrl-width', v);
    }
    if (typeof c.height === 'number') {
      document.documentElement.style.setProperty('--music-ctrl-height', `${c.height}px`);
    }
    if (typeof c.gap === 'number') {
      document.documentElement.style.setProperty('--music-ctrl-gap', `${c.gap}px`);
    }
    if (typeof c.buttonSize === 'number') {
      document.documentElement.style.setProperty('--music-btn-size', `${c.buttonSize}px`);
    }
  }

  // 应用字体配置
  if (config.fonts) {
    if (config.fonts.article) {
      const articleFont = config.fonts.article;
      if (articleFont.family) {
        document.documentElement.style.setProperty('--article-font-family', articleFont.family);
      }
      if (articleFont.size) {
        document.documentElement.style.setProperty('--article-font-size', articleFont.size);
      }
      if (articleFont.lineHeight) {
        document.documentElement.style.setProperty('--article-line-height', articleFont.lineHeight);
      }
    }
    if (config.fonts.body) {
      const bodyFont = config.fonts.body;
      if (bodyFont.family) {
        document.documentElement.style.setProperty('--body-font-family', bodyFont.family);
      }
      if (bodyFont.size) {
        document.documentElement.style.setProperty('--body-font-size', bodyFont.size);
      }
    }
  }
};

// 更新侧边栏底部留白，确保内容不被底部按钮遮挡
function updateSidebarBottomPadding() {
  const bottomTools = document.querySelector('.bottom-tools');
  const sidebar = document.querySelector('.sidebar');
  
  if (!bottomTools || !sidebar) {
    // 如果按钮或侧边栏还没加载，延迟执行
    setTimeout(updateSidebarBottomPadding, 100);
    return;
  }
  
  // 获取侧边栏和按钮的位置
  const sidebarRect = sidebar.getBoundingClientRect();
  const buttonRect = bottomTools.getBoundingClientRect();
  
  // 检查按钮是否在侧边栏宽度范围内（考虑按钮可能在侧边栏左侧）
  const buttonLeft = buttonRect.left;
  const buttonRight = buttonRect.right;
  const sidebarLeft = sidebarRect.left;
  const sidebarRight = sidebarRect.right;
  
  // 如果按钮在侧边栏范围内或与侧边栏重叠
  if (buttonRight > sidebarLeft && buttonLeft < sidebarRight) {
    // 计算按钮顶部距离视口底部的距离
    const buttonTopFromBottom = window.innerHeight - buttonRect.top;
    
    // 计算需要的遮挡层高度：按钮顶部到视口底部的距离 + 额外留白
    const requiredOverlayHeight = buttonTopFromBottom + 12; // 12px 额外留白，确保完全遮挡
    
    // 获取当前配置的 padding 和遮挡层高度
    const currentPadding = getComputedStyle(document.documentElement)
      .getPropertyValue('--sidebar-content-bottom-padding');
    const currentPaddingValue = parseInt(currentPadding) || 60;
    
    const currentOverlay = getComputedStyle(document.documentElement)
      .getPropertyValue('--sidebar-bottom-overlay-height');
    const currentOverlayValue = parseInt(currentOverlay) || 60;
    
    // 使用较大的值（用户配置或计算值）
    const finalPadding = Math.max(requiredOverlayHeight, currentPaddingValue);
    const finalOverlayHeight = Math.max(requiredOverlayHeight, currentOverlayValue);
    
    // 同时设置 padding 和遮挡层高度（遮挡层高度应该 >= padding）
    document.documentElement.style.setProperty(
      '--sidebar-content-bottom-padding', 
      `${finalPadding}px`
    );
    document.documentElement.style.setProperty(
      '--sidebar-bottom-overlay-height', 
      `${finalOverlayHeight}px`
    );
    
    console.log('[Sidebar] 底部留白已更新 - Padding:', finalPadding, 'px, Overlay:', finalOverlayHeight, 'px');
  } else {
    // 如果按钮不在侧边栏范围内，使用配置的默认值
    const currentPadding = getComputedStyle(document.documentElement)
      .getPropertyValue('--sidebar-content-bottom-padding');
    const currentOverlay = getComputedStyle(document.documentElement)
      .getPropertyValue('--sidebar-bottom-overlay-height');
    
    if (!currentPadding || currentPadding === '60px') {
      document.documentElement.style.setProperty(
        '--sidebar-content-bottom-padding', 
        '60px'
      );
    }
    if (!currentOverlay || currentOverlay === '60px') {
      document.documentElement.style.setProperty(
        '--sidebar-bottom-overlay-height', 
        '60px'
      );
    }
  }
}

// 监听窗口大小变化，重新计算
if (typeof window !== 'undefined') {
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      updateSidebarBottomPadding();
    }, 100);
  });
  
  // 页面加载完成后也计算一次
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateSidebarBottomPadding);
  } else {
    setTimeout(updateSidebarBottomPadding, 100);
  }
}