/**
 * 页面管理器
 * 负责管理不同页面之间的切换和初始化
 */

import { qs, qsa } from '../utils/utils.js';
import * as UI from '../ui.js';
import * as TrophyPage from './trophy-page.js';

// 页面配置
const PAGE_CONFIG = {
  home: {
    gridSelector: '.grid',
    initFn: (grid, pager) => {
      UI.setPaginationSource('.grid');
      UI.adjustGridLayout();
      if (pager) pager.classList.remove('content-loading');
    }
  },
  trophy_list: {
    gridSelector: null, // 使用 blank-view
    initFn: async (blankView, pager) => {
      await TrophyPage.initTrophyPage(blankView, pager);
    }
  },
  // 其他页面可以在这里添加
  default: {
    gridSelector: '.grid',
    initFn: (grid, pager) => {
      UI.setPaginationSource('.grid');
      if (pager) pager.classList.remove('content-loading');
    }
  }
};

let currentPageId = 'home';
let grid = null;
let blankView = null;
let pager = null;

/**
 * 初始化页面管理器
 */
export function init() {
  const contentScroll = qs('.content-scroll');
  if (!contentScroll) {
    console.warn('[PageManager] content-scroll 不存在');
    return;
  }
  
  // 获取或创建必要的元素
  grid = qs('.grid');
  blankView = contentScroll.querySelector('.blank-view');
  if (!blankView && contentScroll) {
    const footer = contentScroll.querySelector('.footer');
    blankView = document.createElement('section');
    blankView.className = 'blank-view';
    blankView.style.display = 'none';
    if (footer) {
      contentScroll.insertBefore(blankView, footer);
    } else {
      contentScroll.appendChild(blankView);
    }
  }
  
  pager = qs('nav.tabs .pager');
  
  // 绑定标签页点击事件
  const tabs = qsa('nav.tabs a');
  if (tabs && tabs.length) {
    tabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        e.preventDefault();
        const href = tab.getAttribute('href') || '#home';
        const id = href.replace('#', '') || 'home';
        navigateToPage(id);
      });
    });
  }
  
  // 监听 hash 变化
  window.addEventListener('hashchange', () => {
    const id = (location.hash || '').replace('#', '') || 'home';
    navigateToPage(id);
  });
  
  // 初始化当前页面
  const initId = (location.hash || '').replace('#', '') || 'home';
  navigateToPage(initId);
}

/**
 * 导航到指定页面
 */
export async function navigateToPage(pageId) {
  if (currentPageId === pageId) {
    return; // 已经在当前页面
  }
  
  currentPageId = pageId;
  
  // 更新标签页激活状态
  const tabs = qsa('nav.tabs a');
  const targetHash = `#${pageId}`;
  tabs.forEach(tab => {
    const href = tab.getAttribute('href') || '';
    tab.classList.toggle('active', href === targetHash);
  });
  
  // 获取页面配置
  const config = PAGE_CONFIG[pageId] || PAGE_CONFIG.default;
  const isTrophyPage = pageId === 'trophy_list';
  
  // 显示/隐藏相应的容器
  if (grid) {
    grid.style.display = isTrophyPage ? 'none' : '';
  }
  if (blankView) {
    blankView.style.display = isTrophyPage ? '' : 'none';
  }
  if (pager) {
    pager.style.display = '';
  }
  
  // 初始化页面
  try {
    if (isTrophyPage) {
      await config.initFn(blankView, pager);
    } else {
      config.initFn(grid, pager);
    }
  } catch (error) {
    console.error(`[PageManager] 初始化页面 ${pageId} 失败:`, error);
    if (pager) {
      pager.classList.remove('content-loading');
    }
  }
  
  // 更新 URL hash（不触发 hashchange 事件）
  const url = new URL(location.href);
  url.hash = `#${pageId}`;
  history.replaceState(null, '', url.href);
}

/**
 * 获取当前页面 ID
 */
export function getCurrentPageId() {
  return currentPageId;
}

