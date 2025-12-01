/**
 * 点击涟漪特效
 */

import { rippleConfig } from '../config.js';

let canvas = null;
let ctx = null;
let animationId = null;
let resizeHandler = null;
let clickHandler = null;
let ripples = [];

// 更新涟漪
const updateRipple = (ripple) => {
  ripple.radius += rippleConfig.growSpeed;
  ripple.alpha *= rippleConfig.alphaDecay;
  ripple.lineWidth *= rippleConfig.lineWidthDecay;
};

// 检查涟漪是否应该移除
const shouldRemoveRipple = (ripple) => {
  return ripple.radius > ripple.maxRadius || ripple.alpha < 0.03;
};

// 动画循环
const animate = () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  ripples = ripples.filter(ripple => {
    updateRipple(ripple);
    
    if (shouldRemoveRipple(ripple)) {
      return false;
    }
    
    ctx.beginPath();
    ctx.arc(ripple.x, ripple.y, ripple.radius, 0, Math.PI * 2);
    ctx.lineWidth = ripple.lineWidth;
    ctx.strokeStyle = `hsla(${ripple.hue}, 90%, 65%, ${ripple.alpha})`;
    ctx.stroke();
    
    return true;
  });
  
  animationId = requestAnimationFrame(animate);
};

// 点击处理
const handleClick = (event) => {
  ripples.push({
    x: event.clientX,
    y: event.clientY,
    radius: 0,
    maxRadius: rippleConfig.maxRadius,
    lineWidth: rippleConfig.lineWidth,
    alpha: rippleConfig.alphaStart,
    hue: Math.random() * 360
  });
};

// 启用涟漪效果
export const enable = () => {
  if (canvas) return;
  
  canvas = document.createElement('canvas');
  canvas.className = 'bg-click-ripple';
  canvas.style.cssText = `position:fixed;left:0;top:0;width:100%;height:100%;z-index:${rippleConfig.zIndex};pointer-events:none`;
  document.body.appendChild(canvas);
  
  resizeHandler = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  resizeHandler();
  window.addEventListener('resize', resizeHandler);
  
  ctx = canvas.getContext('2d');
  
  clickHandler = handleClick;
  window.addEventListener('click', clickHandler);
  
  animate();
};

// 禁用涟漪效果
export const disable = () => {
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  
  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler);
    resizeHandler = null;
  }
  
  if (clickHandler) {
    window.removeEventListener('click', clickHandler);
    clickHandler = null;
  }
  
  if (canvas) {
    canvas.remove();
    canvas = null;
    ctx = null;
  }
  
  ripples = [];
};