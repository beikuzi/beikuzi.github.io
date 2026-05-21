/**
 * 特效管理器
 */

import * as Star from './star.js';
import * as Ripple from './ripples.js';

let currentEffect = 'none';

// 特效映射表
const effects = {
  starTrail: Star,
  ripple: Ripple,
  none: null
};

// 渐变背景
export const enableGradient = () => {
  if (document.querySelector('.bg-anim')) return;
  const div = document.createElement('div');
  div.className = 'bg-anim';
  document.body.appendChild(div);
};

export const disableGradient = () => {
  const div = document.querySelector('.bg-anim');
  if (div) div.remove();
};

// 设置特效
export const setEffect = (effectName) => {
  // 禁用当前特效
  if (currentEffect !== 'none' && effects[currentEffect]) {
    effects[currentEffect].disable();
  }
  
  // 启用新特效
  currentEffect = effectName;
  if (effectName !== 'none' && effects[effectName]) {
    effects[effectName].enable();
  }
};

// 获取当前特效
export const getCurrentEffect = () => currentEffect;

// 禁用所有特效
export const disableAll = () => {
  Object.keys(effects).forEach(key => {
    if (effects[key]) {
      effects[key].disable();
    }
  });
  currentEffect = 'none';
};

export const enableAllVisuals = () => {
  Star.enable();
  Ripple.enable();
};

// 检查特效是否可用
export const isEffectAvailable = (effectName) => {
  return effectName in effects;
};

// 获取所有可用特效列表
export const getAvailableEffects = () => {
  return Object.keys(effects);
};