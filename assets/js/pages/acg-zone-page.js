/**
 * 次元放松区页面模块
 */

import { qs } from '../utils/utils.js';
import * as UI from '../ui.js';

let __acgLoaded = false;
let __acgGrid = null;
let __categoryObserver = null;

/**
 * 解析 Markdown 格式的 ACG 列表
 * 支持格式：
 * - 分类名 | 说明语
 * - 分类名: 说明语
 * - 分类名（仅分类名）
 */
function parseAcgMarkdown(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length);
  const stack = [];
  const categories = {}; // 存储分类信息 {name, desc}
  const items = []; // 存储项目列表
  
  const parseIndent = (s) => {
    const m = s.match(/^(\s*)-/);
    if (!m) return 0;
    const ws = m[1] || '';
    const tabs = (ws.match(/\t/g) || []).length;
    const spaces = (ws.match(/ /g) || []).length;
    return tabs + Math.floor(spaces / 2);
  };
  
  const parseItem = (s) => {
    const m = s.match(/\[([^\]]+)\]\(([^)]+)\)\(([^)]+)\)/);
    if (!m) return null;
    return { name: m[1].trim(), icon: m[2].trim(), desc: m[3].trim() };
  };
  
  const parseCategory = (s) => {
    // 支持格式: "分类名 | 说明语" 或 "分类名: 说明语" 或 "分类名"
    const pipeMatch = s.match(/^(.+?)\s*[|]\s*(.+)$/);
    const colonMatch = s.match(/^(.+?):\s*(.+)$/);
    if (pipeMatch) {
      return { name: pipeMatch[1].trim(), desc: pipeMatch[2].trim() };
    } else if (colonMatch) {
      return { name: colonMatch[1].trim(), desc: colonMatch[2].trim() };
    } else {
      return { name: s.trim(), desc: '' };
    }
  };
  
  lines.forEach(raw => {
    const line = raw.trimEnd();
    const ind = parseIndent(raw);
    const content = line.replace(/^[-\s]+/, '');
    const item = parseItem(content);
    
    // 维护分类栈
    while (stack.length && stack[stack.length - 1].ind >= ind) stack.pop();
    
    if (item) {
      // 项目项
      const catName = stack.length ? stack[stack.length - 1].name : '未分类';
      items.push({
        ...item,
        cat: catName
      });
    } else {
      // 分类项
      const catInfo = parseCategory(content);
      const node = { type: 'cat', ind, name: catInfo.name, desc: catInfo.desc };
      stack.push(node);
      
      // 存储分类信息（只存储顶级分类，避免重复）
      if (ind === 0 && !categories[catInfo.name]) {
        categories[catInfo.name] = catInfo.desc;
      }
    }
  });
  
  return { categories, items };
}

/**
 * 渲染分类标牌
 */
function renderCategoryHeader(catName, catDesc, style, container) {
  const header = document.createElement('div');
  header.className = `trophy-category-header category-${style}`;
  // 添加 ID 锚点，用于导航定位
  const anchorId = `cat-${catName.replace(/\s+/g, '-')}`;
  header.id = anchorId;
  header.setAttribute('data-category', catName);
  
  const icon = document.createElement('div');
  icon.className = 'category-icon';
  // 根据分类名选择图标
  const catIcons = {
    '游戏': '🎮',
    '番剧': '📺',
    '其他': '⭐'
  };
  icon.textContent = catIcons[catName] || '🏆';
  
  const content = document.createElement('div');
  content.className = 'category-content';
  
  const title = document.createElement('h3');
  title.className = 'category-title';
  title.textContent = catName;
  
  if (catDesc) {
    const desc = document.createElement('p');
    desc.className = 'category-desc';
    desc.textContent = catDesc;
    content.appendChild(title);
    content.appendChild(desc);
  } else {
    content.appendChild(title);
  }
  
  header.appendChild(icon);
  header.appendChild(content);
  container.appendChild(header);
}

/**
 * 渲染单个项目卡片
 */
function renderAcgCard(item, style, container) {
  const card = document.createElement('article');
  card.className = `trophy-card badge-${style}`;
  
  const wrap = document.createElement('div');
  wrap.className = 'badge';
  
  // 图标
  const iconBox = document.createElement('div');
  iconBox.className = 'badge-icon';
  const isHttp = /^https?:\/\//i.test(item.icon);
  const isImg = isHttp && /\.(png|jpg|jpeg|svg|webp)$/i.test(item.icon);
  if (isImg) {
    const img = document.createElement('img');
    img.src = item.icon;
    img.alt = item.name;
    iconBox.appendChild(img);
  } else {
    iconBox.textContent = item.icon;
  }
  
  // 信息
  const infoBox = document.createElement('div');
  infoBox.className = 'badge-info';
  
  const title = document.createElement('div');
  title.className = 'badge-title';
  title.textContent = item.name;
  
  const desc = document.createElement('div');
  desc.className = 'badge-desc';
  desc.textContent = item.desc;
  
  infoBox.appendChild(title);
  infoBox.appendChild(desc);
  
  wrap.appendChild(iconBox);
  wrap.appendChild(infoBox);
  card.appendChild(wrap);
  
  // 如果是链接，添加点击事件
  if (isHttp && !isImg) {
    card.style.cursor = 'pointer';
    card.addEventListener('click', () => {
      try {
        window.open(item.icon, '_blank');
      } catch (_) {}
    });
  }
  
  container.appendChild(card);
}

/**
 * 创建页面内导航侧边栏
 */
function createPageNavSidebar(categories, blankView) {
  // 检查是否已存在侧边栏
  let sidebar = blankView.querySelector('.page-nav-sidebar');
  if (sidebar) {
    sidebar.remove();
  }
  
  if (Object.keys(categories).length === 0) return null;
  
  sidebar = document.createElement('nav');
  sidebar.className = 'page-nav-sidebar';
  sidebar.setAttribute('aria-label', '页面导航');
  
  const sidebarList = document.createElement('ul');
  sidebarList.className = 'page-nav-list';
  
  // 为每个分类创建导航项
  Object.keys(categories).forEach(catName => {
    const listItem = document.createElement('li');
    listItem.className = 'page-nav-item';
    
    const link = document.createElement('a');
    link.href = `#cat-${catName.replace(/\s+/g, '-')}`;
    link.className = 'page-nav-link';
    link.textContent = catName;
    link.setAttribute('data-category', catName);
    
    // 点击事件：平滑滚动到对应区域
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = link.getAttribute('href').substring(1);
      const targetElement = document.getElementById(targetId);
      if (targetElement) {
        // 使用平滑滚动，并考虑顶部导航栏的高度
        const headerOffset = 80; // 顶部导航栏高度
        const elementPosition = targetElement.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
        
        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
        
        // 更新 URL hash（不触发页面跳转）
        history.pushState(null, '', `#acg_zone#${targetId}`);
      }
    });
    
    listItem.appendChild(link);
    sidebarList.appendChild(listItem);
  });
  
  sidebar.appendChild(sidebarList);
  blankView.appendChild(sidebar);
  return sidebar;
}

/**
 * 初始化 Intersection Observer 来高亮当前可见的分类
 */
function initCategoryObserver(blankView) {
  const categoryHeaders = blankView.querySelectorAll('.trophy-category-header');
  const navLinks = blankView.querySelectorAll('.page-nav-link');
  
  if (categoryHeaders.length === 0 || navLinks.length === 0) return;
  
  // 创建 Intersection Observer
  const observer = new IntersectionObserver((entries) => {
    // 找到最接近顶部的可见分类
    let activeEntry = null;
    let maxRatio = 0;
    
    entries.forEach(entry => {
      if (entry.isIntersecting && entry.intersectionRatio > maxRatio) {
        maxRatio = entry.intersectionRatio;
        activeEntry = entry;
      }
    });
    
    // 如果找到了可见的分类，高亮对应的导航链接
    if (activeEntry) {
      const categoryName = activeEntry.target.getAttribute('data-category');
      const navLink = blankView.querySelector(`.page-nav-link[data-category="${categoryName}"]`);
      
      navLinks.forEach(link => link.classList.remove('active'));
      if (navLink) {
        navLink.classList.add('active');
      }
    }
  }, {
    root: null,
    rootMargin: '-100px 0px -60% 0px', // 考虑顶部导航栏高度，只关注上半部分可见的分类
    threshold: [0, 0.1, 0.3, 0.5, 0.7, 1]
  });
  
  // 观察所有分类标牌
  categoryHeaders.forEach(header => {
    observer.observe(header);
  });
  
  return observer;
}

/**
 * 渲染项目卡片（按分类分组）
 */
function renderAcgCards(data, container) {
  const { categories, items } = data;
  // 为游戏和番剧分配蓝色和黄色样式
  const catStyleMap = {
    '游戏': 'blue',
    '番剧': 'yellow'
  };
  const catStyle = {};
  
  // 为每个分类分配样式
  Object.keys(categories).forEach(catName => {
    if (catStyleMap[catName]) {
      catStyle[catName] = catStyleMap[catName];
    } else {
      catStyle[catName] = 'blue'; // 默认蓝色
    }
  });
  
  // 按分类分组项目
  const itemsByCat = {};
  items.forEach(item => {
    const cat = item.cat || '未分类';
    if (!itemsByCat[cat]) {
      itemsByCat[cat] = [];
    }
    itemsByCat[cat].push(item);
  });
  
  container.innerHTML = '';
  
  // 渲染每个分类
  Object.keys(itemsByCat).forEach(catName => {
    const catItems = itemsByCat[catName];
    const style = catStyle[catName] || 'blue';
    const catDesc = categories[catName] || '';
    
    // 创建分类容器
    const categorySection = document.createElement('section');
    categorySection.className = 'trophy-category-section';
    
    // 渲染分类标牌
    renderCategoryHeader(catName, catDesc, style, categorySection);
    
    // 创建项目容器（按行排列）
    const itemsContainer = document.createElement('div');
    itemsContainer.className = 'trophy-achievements-row';
    
    // 渲染该分类下的所有项目
    catItems.forEach(item => {
      renderAcgCard(item, style, itemsContainer);
    });
    
    categorySection.appendChild(itemsContainer);
    container.appendChild(categorySection);
  });
}

/**
 * 加载 ACG 数据
 */
async function loadAcg() {
  const mdUrl = '/assets/docs/acg_list.md';
  try {
    const res = await fetch(mdUrl, { cache: 'no-store' });
    if (!res || !res.ok) {
      console.warn('[ACG] 无法加载 ACG 列表');
      return [];
    }
    const text = await res.text();
    return parseAcgMarkdown(text);
  } catch (error) {
    console.warn('[ACG] 加载 ACG 列表失败:', error);
    return [];
  }
}

/**
 * 确保 ACG 网格容器存在
 */
function ensureAcgGrid(blankView) {
  if (!blankView) return null;
  
  let grid = blankView.querySelector('.trophy-grid');
  if (!grid) {
    grid = document.createElement('section');
    grid.className = 'trophy-grid';
    blankView.appendChild(grid);
  }
  return grid;
}

/**
 * 初始化次元放松区页面
 */
export async function initAcgZonePage(blankView, pager) {
  if (!blankView) {
    console.warn('[ACG] blankView 不存在');
    return;
  }
  
  // 确保网格容器存在
  const grid = ensureAcgGrid(blankView);
  if (!grid) {
    console.warn('[ACG] 无法创建 ACG 网格');
    return;
  }
  
  __acgGrid = grid;
  
  // 清空网格，确保每次都能正确显示
  grid.innerHTML = '';
  
  // 如果已经加载过且有内容，直接返回
  if (__acgLoaded && grid.children.length > 0) {
    return;
  }
  
  // 显示加载状态
  if (pager) {
    pager.classList.add('content-loading');
  }
  
  try {
    // 加载 ACG 数据
    const data = await loadAcg();
    
    if (data.items && data.items.length > 0) {
      // 渲染项目卡片
      renderAcgCards(data, grid);
      __acgLoaded = true;
      
      // 创建页面内导航侧边栏
      const sidebar = createPageNavSidebar(data.categories, blankView);
      
      // 初始化 Intersection Observer
      if (sidebar) {
        setTimeout(() => {
          // 清理旧的 observer
          if (__categoryObserver) {
            __categoryObserver.disconnect();
          }
          __categoryObserver = initCategoryObserver(blankView);
        }, 200);
      }
      
      // 如果 URL 中有锚点，滚动到对应位置
      if (location.hash && location.hash.includes('cat-')) {
        setTimeout(() => {
          const targetId = location.hash.split('#').pop();
          const targetElement = document.getElementById(targetId);
          if (targetElement) {
            const headerOffset = 80;
            const elementPosition = targetElement.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
            window.scrollTo({
              top: offsetPosition,
              behavior: 'smooth'
            });
          }
        }, 400);
      }
    } else {
      grid.innerHTML = '<div style="text-align: center; padding: 40px; color: #999;">暂无内容</div>';
    }
  } catch (error) {
    console.error('[ACG] 初始化失败:', error);
    grid.innerHTML = '<div style="text-align: center; padding: 40px; color: #f00;">加载失败，请刷新重试</div>';
  } finally {
    // 移除加载状态
    if (pager) {
      pager.classList.remove('content-loading');
    }
  }
}

/**
 * 重置次元放松区页面状态（用于重新加载）
 */
export function resetAcgZonePage() {
  __acgLoaded = false;
  __acgGrid = null;
  // 清理 observer
  if (__categoryObserver) {
    __categoryObserver.disconnect();
    __categoryObserver = null;
  }
}

