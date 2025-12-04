/**
 * 页面管理器
 * 负责管理不同页面之间的切换和初始化
 */

import { qs, qsa } from '../utils/utils.js';
import * as UI from '../ui.js';
import * as HomePage from './home-page.js';
import * as TrophyPage from './trophy-page.js';
import * as FriendsPage from './friends-page.js';
import * as AcgZonePage from './acg-zone-page.js';
import * as SkillTreePage from './skill-tree-page.js';
import * as ResumePage from './resume-page.js';
import * as ArticlePage from './article-page.js';
import * as SidebarManager from '../utils/sidebar-manager.js';

/**
 * 应用页面特定的底部留白
 */
function applyPageBottomPadding(pageId) {
  const config = window.__pageBottomPaddingConfig;
  if (!config) return;
  
  // 解析文章页面路由：article_文章标题
  let actualPageId = pageId;
  if (pageId.startsWith('article_')) {
    actualPageId = 'article';
  }
  
  // 获取该页面的留白配置，如果没有则使用默认值
  const paddingValue = config[actualPageId] !== undefined ? config[actualPageId] : config.default;
  if (paddingValue === undefined) return;
  
  const padding = typeof paddingValue === 'number' ? `${paddingValue}px` : paddingValue;
  document.documentElement.style.setProperty('--page-bottom-padding', padding);
  
  // 如果是文章页面，同时设置文章页面的底部padding
  if (actualPageId === 'article') {
    document.documentElement.style.setProperty('--article-page-bottom-padding', padding);
  } else {
    // 非文章页面时，使用默认值
    document.documentElement.style.setProperty('--article-page-bottom-padding', '60px');
  }
}

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
  acg_zone: {
    gridSelector: null, // 使用 blank-view
    initFn: async (blankView, pager) => {
      await AcgZonePage.initAcgZonePage(blankView, pager);
    }
  },
  friends: {
    gridSelector: null, // 使用 blank-view
    initFn: async (blankView, pager) => {
      await FriendsPage.initFriendsPage(blankView, pager);
    }
  },
  skill_tree: {
    gridSelector: null, // 使用 blank-view
    initFn: async (blankView, pager) => {
      await SkillTreePage.initSkillTreePage(blankView, pager);
    }
  },
  resume: {
    gridSelector: null, // 使用 blank-view
    initFn: async (blankView, pager) => {
      await ResumePage.initResumePage(blankView, pager);
    }
  },
  // 文章详情页面（动态路由，格式：article_文章标题）
  article: {
    gridSelector: null,
    initFn: async (blankView, pager, articleTitle) => {
      await ArticlePage.initArticlePage(blankView, pager, articleTitle);
    }
  },
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
  // 解析文章页面路由：article_文章标题
  let articleTitle = null;
  let actualPageId = pageId;
  
  if (pageId.startsWith('article_')) {
    articleTitle = decodeURIComponent(pageId.substring(8));
    actualPageId = 'article';
  }
  
  // 注意：即使页面 ID 相同，也要确保显示/隐藏逻辑正确执行
  // 因为可能在初始化时 grid 和 blankView 的状态不正确
  const wasSamePage = currentPageId === pageId;
  const prevPageId = currentPageId; // 保存之前的页面 ID
  currentPageId = pageId;
  
  // 更新标签页激活状态
  const tabs = qsa('nav.tabs a');
  const targetHash = `#${actualPageId === 'article' ? 'home' : pageId}`;
  tabs.forEach(tab => {
    const href = tab.getAttribute('href') || '';
    // 文章页面时，首页标签保持激活
    tab.classList.toggle('active', href === targetHash);
  });
  
  // 获取页面配置
  const config = PAGE_CONFIG[actualPageId] || PAGE_CONFIG.default;
  const isBlankViewPage = actualPageId === 'trophy_list' || actualPageId === 'acg_zone' || actualPageId === 'friends' || actualPageId === 'skill_tree' || actualPageId === 'resume' || actualPageId === 'article';
  
  // 应用页面特定的底部留白
  applyPageBottomPadding(pageId);
  
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
  // 控制翻页控件的显示/隐藏和恢复
  if (pager) {
    // 成就页面、次元放松区、技能树、简历页面不显示翻页控件
    // 文章页面会显示文章导航（在 article-page.js 中处理）
    if (actualPageId === 'trophy_list' || actualPageId === 'acg_zone' || actualPageId === 'skill_tree' || actualPageId === 'resume') {
      pager.classList.add('pager-hidden');
    } else if (actualPageId === 'article') {
      // 文章页面：先隐藏，等文章加载完成后会替换为导航
      pager.classList.add('pager-hidden');
    } else {
      // 首页等其他页面：显示正常的翻页控件
      pager.classList.remove('pager-hidden');
      // 恢复翻页控件的原始内容（如果被替换了）
      if (pager.classList.contains('article-nav-pager') || !pager.querySelector('.page-prev')) {
        // 如果被替换为文章导航，或者缺少翻页控件元素，需要恢复
        pager.innerHTML = `
          <button class="page-btn page-prev" aria-label="上一页">‹</button>
          <div class="page-info" aria-live="polite">
            <span class="page-label">第</span>
            <select class="page-select" aria-label="选择页码"></select>
            <span class="page-label">页</span>
            <span class="page-total"></span>
          </div>
          <button class="page-btn page-next" aria-label="下一页">›</button>
          <select class="page-size" aria-label="每页数量">
            <option value="12" selected>12</option>
            <option value="30">30</option>
            <option value="60">60</option>
            <option value="120">120</option>
          </select>
        `;
        // 移除所有可能隐藏翻页控件的类
        pager.className = 'pager';
        pager.classList.remove('pagination-loading', 'content-loading', 'pager-hidden', 'article-nav-pager');
      }
    }
  }
  
  // 重置之前页面的状态（只在页面切换时）
  if (prevPageId !== pageId) {
    // 清理之前页面的侧边栏
    SidebarManager.cleanupSidebar();
    
    if (prevPageId === 'home') {
      HomePage.resetHomePage();
    } else if (prevPageId === 'trophy_list') {
      TrophyPage.resetTrophyPage();
    } else if (prevPageId === 'acg_zone') {
      AcgZonePage.resetAcgZonePage();
    } else if (prevPageId === 'friends') {
      FriendsPage.resetFriendsPage();
    } else if (prevPageId === 'skill_tree') {
      SkillTreePage.resetSkillTreePage();
    } else if (prevPageId === 'resume') {
      ResumePage.resetResumePage();
    } else if (prevPageId.startsWith('article_')) {
      ArticlePage.resetArticlePage();
    }
  }
  
  // 初始化页面（即使页面相同也要执行，确保状态正确）
  console.log(`[PageManager] 初始化页面: ${pageId}`, { isBlankViewPage, grid: !!grid, blankView: !!blankView, articleTitle });
  try {
    if (isBlankViewPage) {
      if (!blankView) {
        console.error(`[PageManager] blankView 不存在，无法初始化页面 ${pageId}`);
        return;
      }
      // 文章页面需要传递文章标题
      if (actualPageId === 'article' && articleTitle) {
        await config.initFn(blankView, pager, articleTitle);
      } else {
        await config.initFn(blankView, pager);
      }
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

