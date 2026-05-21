/**
 * Live2D 看板娘
 */

import { loadScript } from './utils.js';

let isLoaded = false;
let isEnabled = false;

// 启用 Live2D
export const enable = async () => {
  if (isEnabled) return;
  
  try {
    // 加载 L2Dwidget 库
    await loadScript('https://unpkg.com/live2d-widget@3.x/lib/L2Dwidget.min.js');
    
    // 初始化 Live2D
    window.L2Dwidget.init({
      model: {
        jsonPath: 'https://unpkg.com/live2d-widget-model-shizuku@1.0.5/assets/shizuku.model.json'
      },
      display: {
        position: 'right',
        width: 160,
        height: 300,
        hOffset: 0,
        vOffset: -20
      },
      mobile: {
        show: true,
        scale: 0.8
      },
      react: {
        opacityDefault: 0.9,
        opacityOnHover: 1
      },
      log: false
    });
    
    isLoaded = true;
    isEnabled = true;
  } catch (error) {
    console.error('Live2D 加载失败:', error);
  }
};

// 禁用 Live2D
export const disable = () => {
  isEnabled = false;
  
  // 移除 Live2D canvas
  const canvas1 = document.getElementById('live2dcanvas');
  if (canvas1) canvas1.remove();
  
  const canvas2 = document.querySelector('canvas.live2d');
  if (canvas2) canvas2.remove();
};

// 检查是否已启用
export const isActive = () => isEnabled;

// 检查是否已加载
export const isLibLoaded = () => isLoaded;