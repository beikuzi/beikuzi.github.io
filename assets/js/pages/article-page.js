/**
 * 文章详情页面模块
 * 负责加载和渲染 Markdown 文章
 */

import { qs } from '../utils/utils.js';
import * as SidebarManager from '../utils/sidebar-manager.js';
import * as Articles from '../utils/articles.js';

// marked.js CDN 加载状态
let __markedLoaded = false;
let __markedPromise = null;

/**
 * 动态加载 marked.js
 */
async function loadMarked() {
  if (__markedLoaded && window.marked) {
    return window.marked;
  }
  
  if (__markedPromise) {
    return __markedPromise;
  }
  
  __markedPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';
    script.onload = () => {
      __markedLoaded = true;
      resolve(window.marked);
    };
    script.onerror = () => {
      reject(new Error('Failed to load marked.js'));
    };
    document.head.appendChild(script);
  });
  
  return __markedPromise;
}

/**
 * 加载文章内容
 * @param {string} title - 文章标题（同时也是文件名）
 */
async function loadArticleContent(title) {
  const articleUrl = `/assets/articles/${encodeURIComponent(title)}.md`;
  
  try {
    const res = await fetch(articleUrl, { cache: 'no-store' });
    if (!res.ok) {
      throw new Error(`文章加载失败: ${res.status}`);
    }
    return await res.text();
  } catch (error) {
    console.error('[Article] 加载文章失败:', error);
    throw error;
  }
}

/**
 * 修正文章中的图片路径
 * @param {string} html - 渲染后的 HTML
 * @param {string} title - 文章标题
 */
function fixImagePaths(html, title) {
  // 将相对路径 ./images/xxx 转换为绝对路径 /assets/articles/images/xxx
  return html.replace(
    /src="\.\/images\//g,
    'src="/assets/articles/images/'
  );
}

/**
 * 获取上一篇和下一篇文章
 */
async function getAdjacentArticles(currentTitle) {
  try {
    const data = await Articles.loadArticles();
    if (!data.articles || data.articles.length === 0) {
      return { prev: null, next: null };
    }
    
    const currentIndex = data.articles.findIndex(a => a.title === currentTitle);
    if (currentIndex === -1) {
      return { prev: null, next: null };
    }
    
    return {
      prev: currentIndex > 0 ? data.articles[currentIndex - 1] : null,
      next: currentIndex < data.articles.length - 1 ? data.articles[currentIndex + 1] : null
    };
  } catch (error) {
    console.warn('[Article] 获取相邻文章失败:', error);
    return { prev: null, next: null };
  }
}

/**
 * 渲染文章页面
 */
function renderArticlePage(container, title, content, html) {
  container.innerHTML = `
    <div class="article-page">
      <div class="article-header">
        <h1 class="article-title">${escapeHtml(title)}</h1>
      </div>
      <article class="article-content markdown-body">
        ${html}
      </article>
    </div>
  `;
  
  // 为文章中的图片添加点击放大功能
  const images = container.querySelectorAll('.article-content img');
  images.forEach(img => {
    img.style.cursor = 'pointer';
    img.addEventListener('click', () => {
      openImagePreview(img.src);
    });
  });
}

/**
 * 在翻页控件位置渲染文章导航（上一篇/下一篇）- 简洁箭头版
 */
function renderArticleNavInPager(pager, prevArticle, nextArticle) {
  if (!pager) return;
  
  // 移除隐藏类，显示翻页控件
  pager.classList.remove('pager-hidden');
  
  // 清空原有内容
  pager.innerHTML = '';
  pager.className = 'pager article-nav-pager-simple';
  
  // 构建简洁的箭头导航
  const navHTML = `
    ${prevArticle ? `
      <a href="#article_${encodeURIComponent(prevArticle.title)}" class="article-arrow-btn article-arrow-prev" title="${escapeHtml(prevArticle.title)}">
        <span class="arrow-icon">‹</span>
        <span class="arrow-text">${escapeHtml(prevArticle.title)}</span>
      </a>
    ` : '<div class="article-arrow-placeholder"></div>'}
    ${nextArticle ? `
      <a href="#article_${encodeURIComponent(nextArticle.title)}" class="article-arrow-btn article-arrow-next" title="${escapeHtml(nextArticle.title)}">
        <span class="arrow-text">${escapeHtml(nextArticle.title)}</span>
        <span class="arrow-icon">›</span>
      </a>
    ` : '<div class="article-arrow-placeholder"></div>'}
  `;
  
  pager.innerHTML = navHTML;
}

/**
 * 打开图片预览
 */
function openImagePreview(src) {
  // 创建预览遮罩
  const overlay = document.createElement('div');
  overlay.className = 'image-preview-overlay';
  overlay.innerHTML = `
    <div class="image-preview-container">
      <img src="${src}" alt="预览图片">
      <button class="image-preview-close" aria-label="关闭">×</button>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  // 点击关闭
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.classList.contains('image-preview-close')) {
      overlay.remove();
    }
  });
  
  // ESC 关闭
  const handleEsc = (e) => {
    if (e.key === 'Escape') {
      overlay.remove();
      document.removeEventListener('keydown', handleEsc);
    }
  };
  document.addEventListener('keydown', handleEsc);
}

/**
 * HTML 转义
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 解析文章标题生成目录
 */
function parseTableOfContents(html) {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  
  const headings = tempDiv.querySelectorAll('h1, h2, h3, h4, h5, h6');
  const toc = [];
  
  headings.forEach((heading, index) => {
    const level = parseInt(heading.tagName.charAt(1));
    const text = heading.textContent;
    const id = `heading-${index}`;
    heading.id = id;
    
    toc.push({
      id,
      text,
      level
    });
  });
  
  return { toc, html: tempDiv.innerHTML };
}

/**
 * 初始化文章页面
 * @param {HTMLElement} blankView - 页面容器
 * @param {HTMLElement} pager - 翻页控件
 * @param {string} articleTitle - 文章标题
 */
export async function initArticlePage(blankView, pager, articleTitle) {
  if (!blankView) {
    console.warn('[Article] blankView 不存在');
    return;
  }
  
  // 显示加载状态
  blankView.innerHTML = `
    <div class="article-loading">
      <div class="loading-spinner"></div>
      <p>正在加载文章...</p>
    </div>
  `;
  
  // 不隐藏翻页控件，而是准备替换为文章导航
  if (pager) {
    pager.classList.add('pager-hidden');
  }
  
  try {
    // 并行加载 marked.js 和文章内容
    const [marked, content] = await Promise.all([
      loadMarked(),
      loadArticleContent(articleTitle)
    ]);
    
    // 配置 marked
    marked.setOptions({
      breaks: true,
      gfm: true,
      headerIds: true
    });
    
    // 渲染 Markdown
    let html = marked.parse(content);
    
    // 修正图片路径
    html = fixImagePaths(html, articleTitle);
    
    // 解析目录
    const { toc, html: htmlWithIds } = parseTableOfContents(html);
    
    // 获取上一篇和下一篇文章
    const { prev, next } = await getAdjacentArticles(articleTitle);
    
    // 渲染页面（不包含导航，导航在翻页控件位置显示）
    renderArticlePage(blankView, articleTitle, content, htmlWithIds);
    
    // 在翻页控件位置显示上一篇/下一篇导航
    renderArticleNavInPager(pager, prev, next);
    
    // 更新侧边栏：如果有目录显示目录，否则显示文章列表
    if (toc.length > 0) {
      // 有目录，显示目录
      const sidebarItems = [{
        name: '目录',
        icon: '📑',
        children: toc.map(item => ({
          id: item.id,
          name: item.text
        }))
      }];
      SidebarManager.updateSidebar(sidebarItems);
    } else {
      // 没有目录，显示文章列表（就像首页那样）
      try {
        const data = await Articles.loadArticles();
        if (data.articles && data.articles.length > 0) {
          const grouped = Articles.groupByCategory(data.articles);
          
          // 找到当前文章的索引
          const currentIndex = data.articles.findIndex(a => a.title === articleTitle);
          
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
              children: catArticles.map((article, idx) => {
                const articleIndex = data.articles.indexOf(article);
                return {
                  id: `article-nav-${articleIndex}`, // 使用不同的 ID 前缀，避免与目录冲突
                  name: article.title,
                  // 添加自定义属性，用于跳转到文章
                  articleTitle: article.title,
                  isCurrent: article.title === articleTitle
                };
              })
            };
          });
          
          if (sidebarItems.length > 0) {
            SidebarManager.updateSidebar(sidebarItems, currentIndex >= 0 ? `article-nav-${currentIndex}` : null);
          }
        }
      } catch (error) {
        console.warn('[Article] 加载文章列表失败:', error);
      }
    }
    
  } catch (error) {
    console.error('[Article] 初始化失败:', error);
    blankView.innerHTML = `
      <div class="article-error">
        <h2>😢 文章加载失败</h2>
        <p>${escapeHtml(error.message)}</p>
        <button class="error-back" onclick="location.hash='#home'">返回首页</button>
      </div>
    `;
  }
}

/**
 * 重置文章页面状态
 */
export function resetArticlePage() {
  SidebarManager.cleanupSidebar();
}

