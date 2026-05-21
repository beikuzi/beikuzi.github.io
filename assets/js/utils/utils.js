/**
 * DOM 工具函数
 */

// 快速选择器 - 单个元素
export const qs = (selector) => document.querySelector(selector);

// 快速选择器 - 多个元素
export const qsa = (selector) => document.querySelectorAll(selector);

// 动态加载外部脚本
export const loadScript = (src) => new Promise((resolve, reject) => {
  // 检查脚本是否已加载
  if (document.querySelector(`script[src="${src}"]`)) {
    return resolve();
  }
  
  const script = document.createElement('script');
  script.src = src;
  script.onload = resolve;
  script.onerror = reject;
  document.head.appendChild(script);
});

// 展开所有分类
export const openAll = () => {
  qsa('.cat').forEach(cat => cat.classList.add('open'));
};

// 折叠所有分类
export const closeAll = () => {
  qsa('.cat').forEach(cat => cat.classList.remove('open'));
};

// 切换分类展开状态
export const toggleCat = (event) => {
  event.currentTarget.closest('.cat').classList.toggle('open');
};