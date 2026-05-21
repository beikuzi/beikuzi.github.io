/**
 * 星轨特效
 */

import { starConfig } from '../config.js';

let canvas = null;
let ctx = null;
let animationId = null;
let resizeHandler = null;
let mouseMoveHandler = null;
let stars = [];
let lastSpawnTime = 0;

// 绘制星形
const drawStar = (x, y, radius, rotation) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  
  ctx.beginPath();
  const spikes = 5;
  const step = Math.PI / spikes;
  let angle = -Math.PI / 2;
  
  for (let i = 0; i < spikes; i++) {
    ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
    angle += step;
    ctx.lineTo(
      Math.cos(angle) * radius * 0.5,
      Math.sin(angle) * radius * 0.5
    );
    angle += step;
  }
  
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};

// 更新星星
const updateStar = (star) => {
  star.x += star.velocityX;
  star.y += star.velocityY;
  star.velocityY -= 0.01; // 重力效果
  star.alpha *= starConfig.alphaDecay;
  star.radius *= starConfig.radiusDecay;
  star.rotation += star.rotationSpeed;
};

// 检查星星是否应该移除
const shouldRemoveStar = (star) => {
  return star.alpha < starConfig.minAlphaThreshold || 
         star.radius < starConfig.minRadiusThreshold;
};

// 动画循环
const animate = () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // 更新并绘制星星
  stars = stars.filter(star => {
    updateStar(star);
    
    if (shouldRemoveStar(star)) {
      return false;
    }
    
    ctx.fillStyle = `hsla(${star.hue}, 90%, 70%, ${star.alpha})`;
    drawStar(star.x, star.y, star.radius, star.rotation);
    return true;
  });
  
  animationId = requestAnimationFrame(animate);
};

// 鼠标移动处理
const handleMouseMove = (event) => {
  const now = Date.now();
  if (now - lastSpawnTime < starConfig.spawnIntervalMs) return;
  
  lastSpawnTime = now;
  
  for (let i = 0; i < starConfig.spawnCount; i++) {
    stars.push({
      x: event.clientX + (Math.random() - 0.5) * 6,
      y: event.clientY + (Math.random() - 0.5) * 6,
      velocityX: (Math.random() - 0.5) * starConfig.velocityRange,
      velocityY: (Math.random() - 0.5) * starConfig.velocityRange,
      radius: starConfig.radiusMin + 
              Math.random() * (starConfig.radiusMax - starConfig.radiusMin),
      rotation: Math.random() * Math.PI,
      rotationSpeed: (Math.random() - 0.5) * 0.08,
      alpha: starConfig.initialAlpha,
      hue: 40 + Math.random() * 280
    });
  }
};

// 启用星轨效果
export const enable = () => {
  if (canvas) return;
  
  canvas = document.createElement('canvas');
  canvas.className = 'bg-startrail';
  canvas.style.cssText = `position:fixed;left:0;top:0;width:100%;height:100%;z-index:${starConfig.zIndex};pointer-events:none`;
  document.body.appendChild(canvas);
  
  resizeHandler = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  resizeHandler();
  window.addEventListener('resize', resizeHandler);
  
  ctx = canvas.getContext('2d');
  
  mouseMoveHandler = handleMouseMove;
  window.addEventListener('mousemove', mouseMoveHandler);
  
  animate();
};

// 禁用星轨效果
export const disable = () => {
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  
  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler);
    resizeHandler = null;
  }
  
  if (mouseMoveHandler) {
    window.removeEventListener('mousemove', mouseMoveHandler);
    mouseMoveHandler = null;
  }
  
  if (canvas) {
    canvas.remove();
    canvas = null;
    ctx = null;
  }
  
  stars = [];
  lastSpawnTime = 0;
};