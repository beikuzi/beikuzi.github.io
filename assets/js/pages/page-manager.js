/**
 * 页面管理器
 * 负责管理不同页面之间的切换和初始化
 */

import { qs, qsa } from '../utils/utils.js';
import * as UI from '../ui.js';
import * as HomePage from './home-page.js';
import * as TrophyPage from './trophy-page.js';
import * as FriendsPage from './friends-page.js';

// 页面配置
const PAGE_CONFIG = {
  home: {
    gridSelector: '.grid',
    initFn: (grid, pager) => {
      HomePage.initHomePage(grid, pager);
    }
  },
  trophy_list: {
    gridSelector: null, // 使用 blank-view
    initFn: async (blankView, pager) => {
      await TrophyPage.initTrophyPage(blankView, pager);
    }
  },
  friends: {
    gridSelector: null, // 使用 blank-view
    initFn: async (blankView, pager) => {
      await FriendsPage.initFriendsPage(blankView, pager);
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
    blankView = document.createElement('section');
    blankView.className = 'blank-view';
    blankView.style.display = 'none';
    // 插入到 grid 之后，footer 之前
    const footer = contentScroll.querySelector('.footer');
    if (footer) {
      contentScroll.insertBefore(blankView, footer);
    } else if (grid && grid.parentNode) {
      grid.parentNode.insertBefore(blankView, grid.nextSibling);
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
  // 注意：即使页面 ID 相同，也要确保显示/隐藏逻辑正确执行
  // 因为可能在初始化时 grid 和 blankView 的状态不正确
  const wasSamePage = currentPageId === pageId;
  const prevPageId = currentPageId; // 保存之前的页面 ID
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
  const isBlankViewPage = pageId === 'trophy_list' || pageId === 'friends';
  
  // 显示/隐藏相应的容器
  if (grid) {
    grid.style.display = isBlankViewPage ? 'none' : '';
  }
  if (blankView) {
    blankView.style.display = isBlankViewPage ? '' : 'none';
    // 关键修复：切换页面时清空 blankView，避免内容叠加
    if (isBlankViewPage) {
      blankView.innerHTML = '';
    }
  }
  if (pager) {
    pager.style.display = '';
  }
  
  // 重置之前页面的状态（只在页面切换时）
  if (prevPageId !== pageId) {
    if (prevPageId === 'home') {
      HomePage.resetHomePage();
    } else if (prevPageId === 'trophy_list') {
      TrophyPage.resetTrophyPage();
    } else if (prevPageId === 'friends') {
      FriendsPage.resetFriendsPage();
    }
  }
  
  // 初始化页面（即使页面相同也要执行，确保状态正确）
  console.log(`[PageManager] 初始化页面: ${pageId}`, { isBlankViewPage, grid: !!grid, blankView: !!blankView });
  try {
    if (isBlankViewPage) {
      if (!blankView) {
        console.error(`[PageManager] blankView 不存在，无法初始化页面 ${pageId}`);
        return;
      }
      await config.initFn(blankView, pager);
    } else {
      if (!grid) {
        console.error(`[PageManager] grid 不存在，无法初始化页面 ${pageId}`);
        return;
      }
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

