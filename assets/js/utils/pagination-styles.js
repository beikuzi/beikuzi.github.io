/**
 * 翻页样式管理器
 */

let currentStyle = 'default';
let styleLink = null;

// 可用的翻页样式列表
export const paginationStyles = {
  default: '默认样式',
  sakura: '樱花风格',
  candy: '糖果风格',
  starry: '星空风格',
  dreamy: '梦幻风格',
  tech: '科技风格',
  kawaii: '可爱风格',
  magic: '魔法风格',
  minimal: '简约风格'
};

// 显示翻页组件
const showPager = () => {
  const pager = document.querySelector('.pager');
  if (pager) {
    pager.classList.remove('pagination-loading');
  }
};

// 加载样式文件
const loadStyle = (styleName) => {
  // 先隐藏翻页组件
  const pager = document.querySelector('.pager');
  if (pager) {
    pager.classList.add('pagination-loading');
  }
  
  // 移除旧的样式链接
  if (styleLink) {
    styleLink.remove();
    styleLink = null;
  }
  
  // 如果是默认样式，不加载任何文件，直接显示
  if (styleName === 'default') {
    // 使用 requestAnimationFrame 确保DOM更新后再显示
    requestAnimationFrame(() => {
      setTimeout(() => showPager(), 50);
    });
    return;
  }
  
  // 创建新的样式链接
  styleLink = document.createElement('link');
  styleLink.rel = 'stylesheet';
  styleLink.href = `/assets/css/pagination-styles/${styleName}.css`;
  styleLink.id = 'pagination-style-link';
  
  // 监听样式加载完成
  styleLink.onload = () => {
    // 样式加载完成后显示翻页组件
    requestAnimationFrame(() => {
      setTimeout(() => showPager(), 50);
    });
  };
  
  // 处理加载错误（也显示，避免一直隐藏）
  styleLink.onerror = () => {
    console.warn(`[Pagination] 样式文件加载失败: ${styleName}.css`);
    requestAnimationFrame(() => {
      setTimeout(() => showPager(), 50);
    });
  };
  
  document.head.appendChild(styleLink);
};

// 设置翻页样式
export const setPaginationStyle = (styleName) => {
  if (!paginationStyles[styleName]) {
    console.warn(`[Pagination] 未知的样式: ${styleName}`);
    return;
  }
  
  // 如果样式名称相同，不需要重新加载
  if (currentStyle === styleName) {
    return;
  }
  
  currentStyle = styleName;
  loadStyle(styleName);
  
  // 保存到localStorage
  try {
    localStorage.setItem('paginationStyle', styleName);
  } catch (e) {
    console.warn('[Pagination] 无法保存样式到localStorage:', e);
  }
};

// 获取当前样式
export const getCurrentStyle = () => currentStyle;

// 初始化样式（从localStorage读取或使用默认值）
export const initPaginationStyle = () => {
  let savedStyle = 'default';
  try {
    savedStyle = localStorage.getItem('paginationStyle') || 'default';
  } catch (e) {
    console.warn('[Pagination] 无法读取localStorage:', e);
  }
  
  // 验证样式是否存在
  if (!paginationStyles[savedStyle]) {
    savedStyle = 'default';
  }
  
  setPaginationStyle(savedStyle);
  return savedStyle;
};

