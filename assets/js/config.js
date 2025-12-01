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
};