/**
 * 首页模块
 */

import { qs, qsa } from '../utils/utils.js';
import * as UI from '../ui.js';
import * as SidebarManager from '../utils/sidebar-manager.js';
import * as Articles from '../utils/articles.js';

let __homeLoaded = false;
let __searchInput = null;
let __currentFilter = { query: '', tag: null };
// 用于管理封面高亮动画的定时器
let bannerHighlightTimer = null;
// 当前高亮的 banner 元素引用（用于快速清除）
let currentHighlightedBanner = null;
// requestAnimationFrame ID（用于取消）
let rafId = null;

// 渐变样式列表，当没有封面时随机使用
const GRADIENT_STYLES = ['n1', 'n2', 'n3'];

/**
 * 创建文章卡片元素
 */
function createArticleCard(article, index) {
  const card = document.createElement('article');
  card.className = 'card';
  card.id = `article-${index}`;
  card.dataset.title = article.title;
  card.dataset.category = article.category || '';
  card.dataset.tags = (article.tags || []).join(',');
  
  // 卡片 banner
  const banner = document.createElement('div');
  banner.className = 'card-banner';
  
  // 处理封面图片
  if (article.cover) {
    // 有指定封面，尝试使用 WebP 版本
    (async () => {
      let webpCover = article.cover;
      try {
        webpCover = await Articles.tryWebPVersion(article.cover);
      } catch (e) {
        // 如果 WebP 检查失败，使用原始封面
        webpCover = article.cover;
      }
      banner.classList.add('has-cover', 'cover-loading');
      const img = new Image();
      img.onload = () => {
        banner.classList.remove('cover-loading');
        banner.style.backgroundImage = `url('${webpCover}')`;
        banner.style.backgroundSize = 'cover';
        banner.style.backgroundPosition = 'center';
        banner.style.opacity = '0';
        requestAnimationFrame(() => {
          banner.style.transition = 'opacity 0.3s ease';
          banner.style.opacity = '1';
        });
      };
      img.onerror = () => {
        // WebP 失败，使用原始封面
        banner.classList.remove('cover-loading');
        banner.style.backgroundImage = `url('${article.cover}')`;
        banner.style.backgroundSize = 'cover';
        banner.style.backgroundPosition = 'center';
      };
      img.src = webpCover;
    })();
  } else {
    // 没有封面，先使用随机渐变背景
    const randomStyle = GRADIENT_STYLES[index % GRADIENT_STYLES.length];
    banner.classList.add(randomStyle);
    
    // 异步加载文章第一张图片（懒加载）
    loadCoverFromArticle(article.title, banner);
  }
  
  // 卡片内容
  const body = document.createElement('div');
  body.className = 'card-body';
  
  const title = document.createElement('div');
  title.className = 'card-title';
  title.textContent = article.title;
  
  const meta = document.createElement('div');
  meta.className = 'card-meta';
  meta.textContent = `${article.category || ''} · ${article.readTime || ''}`;
  
  body.appendChild(title);
  body.appendChild(meta);
  
  // 标签
  if (article.tags && article.tags.length > 0) {
    const tagsDiv = document.createElement('div');
    tagsDiv.className = 'card-tags';
    
    article.tags.forEach(tag => {
      const tagSpan = document.createElement('span');
      tagSpan.className = 'tag';
      tagSpan.textContent = tag;
      tagSpan.addEventListener('click', (e) => {
        e.stopPropagation();
        filterByTag(tag);
      });
      tagsDiv.appendChild(tagSpan);
    });
    
    body.appendChild(tagsDiv);
  }
  
  card.appendChild(banner);
  card.appendChild(body);
  
  // 点击卡片打开文章
  card.addEventListener('click', () => {
    // 触发封面高亮动画
    highlightBanner(banner);
    openArticle(article.title);
  });
  
  return card;
}

/**
 * 异步加载文章第一张图片作为封面（支持懒加载和 WebP）
 */
async function loadCoverFromArticle(title, bannerElement) {
  if (!bannerElement) return;
  
  // 使用 Intersection Observer 实现懒加载
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        observer.unobserve(entry.target);
        loadCoverImage(title, bannerElement);
      }
    });
  }, {
    rootMargin: '50px' // 提前 50px 开始加载
  });
  
  observer.observe(bannerElement);
}

/**
 * 实际加载封面图片
 */
async function loadCoverImage(title, bannerElement) {
  try {
    const coverUrl = await Articles.loadArticleFirstImage(title);
    if (coverUrl && bannerElement) {
      // 添加加载状态
      bannerElement.classList.add('cover-loading');
      
      // 预加载图片
      const img = new Image();
      
      // 设置超时（10秒）
      const timeout = setTimeout(() => {
        bannerElement.classList.remove('cover-loading');
        console.warn(`[Home] 封面加载超时: ${title}`);
      }, 10000);
      
      img.onload = () => {
        clearTimeout(timeout);
        // 图片加载成功，替换渐变背景
        bannerElement.classList.remove('n1', 'n2', 'n3', 'cover-loading');
        bannerElement.classList.add('has-cover');
        bannerElement.style.backgroundImage = `url('${coverUrl}')`;
        bannerElement.style.backgroundSize = 'cover';
        bannerElement.style.backgroundPosition = 'center';
        // 添加淡入动画
        bannerElement.style.opacity = '0';
        requestAnimationFrame(() => {
          bannerElement.style.transition = 'opacity 0.3s ease';
          bannerElement.style.opacity = '1';
        });
      };
      
      img.onerror = () => {
        clearTimeout(timeout);
        bannerElement.classList.remove('cover-loading');
        // 加载失败，保持渐变背景
        console.warn(`[Home] 封面加载失败: ${title}`);
      };
      
      img.src = coverUrl;
    }
  } catch (error) {
    // 加载失败，保持渐变背景
    bannerElement.classList.remove('cover-loading');
    console.warn(`[Home] 加载封面失败: ${title}`, error);
  }
}

/**
 * 清除 banner 的高亮效果（立即停止动画）
 */
function clearBannerHighlight(bannerElement) {
  if (!bannerElement) return;
  
  // 移除事件监听器
  if (bannerElement._highlightAnimationHandler) {
    bannerElement.removeEventListener('animationend', bannerElement._highlightAnimationHandler);
    bannerElement._highlightAnimationHandler = null;
  }
  
  // 移除高亮类
  bannerElement.classList.remove('sidebar-highlight');
  
  // 强制停止 CSS 动画：临时设置 animation: none，然后恢复
  const originalAnimation = bannerElement.style.animation;
  bannerElement.style.animation = 'none';
  // 强制 reflow
  void bannerElement.offsetWidth;
  // 恢复原来的 animation 设置（或空字符串让 CSS 接管）
  bannerElement.style.animation = originalAnimation || '';
}

/**
 * 封面高亮动画
 */
function highlightBanner(bannerElement) {
  if (!bannerElement) return;
  
  // 取消之前的 requestAnimationFrame
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  
  // 清除之前的定时器
  if (bannerHighlightTimer) {
    clearTimeout(bannerHighlightTimer);
    bannerHighlightTimer = null;
  }
  
  // 立即清除之前的高亮（同步操作，避免残留效果）
  if (currentHighlightedBanner && currentHighlightedBanner !== bannerElement) {
    clearBannerHighlight(currentHighlightedBanner);
  }
  
  // 如果点击的是同一个已经在高亮的 banner，先清除再重新开始
  if (currentHighlightedBanner === bannerElement && bannerElement.classList.contains('sidebar-highlight')) {
    clearBannerHighlight(bannerElement);
  }
  
  // 更新当前高亮的 banner 引用
  currentHighlightedBanner = bannerElement;
  
  // 移除之前可能残留的事件监听器标记
  if (bannerElement._highlightAnimationHandler) {
    bannerElement.removeEventListener('animationend', bannerElement._highlightAnimationHandler);
    bannerElement._highlightAnimationHandler = null;
  }
  
  // 使用 requestAnimationFrame 确保 DOM 更新完成
  rafId = requestAnimationFrame(() => {
    rafId = null;
    
    // 再次检查，防止在 requestAnimationFrame 期间被其他点击覆盖
    if (currentHighlightedBanner !== bannerElement) {
      return;
    }
    
    // 添加高亮类
    bannerElement.classList.add('sidebar-highlight');
    
    // 使用 animationend 事件监听动画结束，避免定时器与动画不同步导致闪烁
    const handleAnimationEnd = (e) => {
      // 只处理 sidebarPulse 动画结束（这是最长的动画，1.2s）
      if (e.animationName === 'sidebarPulse') {
        bannerElement.removeEventListener('animationend', handleAnimationEnd);
        bannerElement._highlightAnimationHandler = null;
        
        if (currentHighlightedBanner === bannerElement) {
          // 使用 requestAnimationFrame 确保在下一帧移除类，避免闪烁
          requestAnimationFrame(() => {
            if (currentHighlightedBanner === bannerElement) {
              bannerElement.classList.remove('sidebar-highlight');
              currentHighlightedBanner = null;
            }
          });
        }
      }
    };
    
    bannerElement._highlightAnimationHandler = handleAnimationEnd;
    bannerElement.addEventListener('animationend', handleAnimationEnd);
    
    // 备用定时器：如果 animationend 事件没有触发（如动画被跳过），确保类最终被移除
    bannerHighlightTimer = setTimeout(() => {
      if (bannerElement._highlightAnimationHandler) {
        bannerElement.removeEventListener('animationend', bannerElement._highlightAnimationHandler);
        bannerElement._highlightAnimationHandler = null;
      }
      if (currentHighlightedBanner === bannerElement) {
        bannerElement.classList.remove('sidebar-highlight');
        currentHighlightedBanner = null;
      }
      bannerHighlightTimer = null;
    }, 1500); // 比最长动画多 300ms 作为安全余量
  });
}

/**
 * 打开文章（在原位置打开）
 */
function openArticle(title) {
  // 使用 hash 路由在原位置打开文章
  window.location.hash = `#article_${encodeURIComponent(title)}`;
}

/**
 * 渲染文章卡片到网格
 */
function renderArticles(articles, grid) {
  // 清空现有卡片（保留可能的静态内容）
  const existingCards = grid.querySelectorAll('.card');
  existingCards.forEach(card => card.remove());
  
  // 渲染文章卡片
  articles.forEach((article, index) => {
    const card = createArticleCard(article, index);
    grid.appendChild(card);
  });
}

/**
 * 更新侧边栏
 */
function updateSidebar(data) {
  const { categories, articles } = data;
  const grouped = Articles.groupByCategory(articles);
  
  // 分类图标映射
  const catIcons = {
    'ACG': 'A',
    '技术': 'T',
    '生活': 'L',
    '其他': 'O'
  };
  
  const sidebarItems = Object.keys(grouped).map(catName => {
    const catArticles = grouped[catName];
    return {
      name: catName,
      icon: catIcons[catName] || catName.charAt(0).toUpperCase(),
      children: catArticles.map((article, idx) => ({
        id: `article-${articles.indexOf(article)}`,
        name: article.title
      }))
    };
  });
  
  if (sidebarItems.length > 0) {
    SidebarManager.updateSidebar(sidebarItems);
  }
}

/**
 * 按标签筛选
 */
function filterByTag(tag) {
  __currentFilter.tag = tag;
  __currentFilter.query = '';
  
  // 更新搜索框显示
  if (__searchInput) {
    __searchInput.value = `#${tag}`;
  }
  
  applyFilter();
}

/**
 * 应用筛选
 */
function applyFilter() {
  const grid = qs('.grid');
  if (!grid) return;
  
  const cachedData = Articles.getCachedData();
  if (!cachedData) return;
  
  let filteredArticles = cachedData.articles;
  
  // 标签筛选
  if (__currentFilter.tag) {
    filteredArticles = Articles.filterByTag(__currentFilter.tag, filteredArticles);
  }
  
  // 关键词搜索
  if (__currentFilter.query) {
    filteredArticles = Articles.searchArticles(__currentFilter.query, filteredArticles);
  }
  
  renderArticles(filteredArticles, grid);
  UI.setPaginationSource('.grid');
  UI.adjustGridLayout();
}

/**
 * 初始化搜索功能
 */
function initSearch() {
  __searchInput = qs('.top-search input');
  if (!__searchInput) return;
  
  let debounceTimer = null;
  
  __searchInput.addEventListener('input', (e) => {
    const value = e.target.value.trim();
    
    // 清除之前的定时器
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    
    // 检查是否是标签搜索 (#标签名)
    if (value.startsWith('#')) {
      const tag = value.substring(1).trim();
      __currentFilter.tag = tag || null;
      __currentFilter.query = '';
    } else {
      __currentFilter.tag = null;
      __currentFilter.query = value;
    }
    
    // 防抖处理
    debounceTimer = setTimeout(() => {
      applyFilter();
    }, 200);
  });
  
  // 回车搜索
  __searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      applyFilter();
    }
  });
  
  // ESC 清除搜索
  __searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      __searchInput.value = '';
      __currentFilter.tag = null;
      __currentFilter.query = '';
      applyFilter();
    }
  });
}

/**
 * 初始化首页
 */
export async function initHomePage(grid, pager) {
  console.log('[Home] 初始化首页', { grid, pager });
  
  if (!grid) {
    console.warn('[Home] grid 不存在');
    return;
  }
  
  // 显示加载状态
  if (pager) {
    pager.classList.add('content-loading');
  }
  
  try {
    // 加载文章数据
    const data = await Articles.loadArticles();
    
    if (data.articles && data.articles.length > 0) {
      // 渲染文章卡片
      renderArticles(data.articles, grid);
      
      // 更新侧边栏
      updateSidebar(data);
      
      __homeLoaded = true;
    } else {
      // 如果没有文章数据，清空侧边栏
      console.log('[Home] 没有文章数据');
      SidebarManager.updateSidebar([]);
    }
    
    // 初始化搜索功能
    initSearch();
    
    // 设置翻页源为网格
    UI.setPaginationSource('.grid');
    
    // 调整网格布局
    UI.adjustGridLayout();
    
  } catch (error) {
    console.error('[Home] 初始化失败:', error);
  } finally {
    // 移除加载状态
    if (pager) {
      pager.classList.remove('content-loading', 'pagination-loading');
    }
  }
}

/**
 * 重置首页状态（用于重新加载）
 */
export function resetHomePage() {
  __homeLoaded = false;
  __currentFilter = { query: '', tag: null };
  SidebarManager.cleanupSidebar();
}
