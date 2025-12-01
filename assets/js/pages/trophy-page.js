/**
 * 成就页面模块
 */

import { qs } from '../utils/utils.js';
import * as UI from '../ui.js';

let __trophiesLoaded = false;
let __trophyGrid = null;

/**
 * 解析 Markdown 格式的成就列表
 * 支持格式：
 * - 分类名 | 说明语
 * - 分类名: 说明语
 * - 分类名（仅分类名）
 */
function parseTrophyMarkdown(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length);
  const stack = [];
  const categories = {}; // 存储分类信息 {name, desc}
  const achievements = []; // 存储成就列表
  
  const parseIndent = (s) => {
    const m = s.match(/^(\s*)-/);
    if (!m) return 0;
    const ws = m[1] || '';
    const tabs = (ws.match(/\t/g) || []).length;
    const spaces = (ws.match(/ /g) || []).length;
    return tabs + Math.floor(spaces / 2);
  };
  
  const parseAch = (s) => {
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
    const ach = parseAch(content);
    
    // 维护分类栈
    while (stack.length && stack[stack.length - 1].ind >= ind) stack.pop();
    
    if (ach) {
      // 成就项
      const catName = stack.length ? stack[stack.length - 1].name : '未分类';
      achievements.push({
        ...ach,
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
  
  return { categories, achievements };
}

/**
 * 渲染分类标牌
 */
function renderCategoryHeader(catName, catDesc, style, container) {
  const header = document.createElement('div');
  header.className = `trophy-category-header category-${style}`;
  
  const icon = document.createElement('div');
  icon.className = 'category-icon';
  // 根据分类名选择图标
  const catIcons = {
    '娱乐': '🎮',
    '学习': '📚',
    '技术': '💻',
    '生活': '🌸',
    '创作': '✨',
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
 * 渲染单个成就卡片
 */
function renderTrophyCard(achievement, style, container) {
  const card = document.createElement('article');
  card.className = `trophy-card badge-${style}`;
  
  const wrap = document.createElement('div');
  wrap.className = 'badge';
  
  // 图标
  const iconBox = document.createElement('div');
  iconBox.className = 'badge-icon';
  const isHttp = /^https?:\/\//i.test(achievement.icon);
  const isImg = isHttp && /\.(png|jpg|jpeg|svg|webp)$/i.test(achievement.icon);
  if (isImg) {
    const img = document.createElement('img');
    img.src = achievement.icon;
    img.alt = achievement.name;
    iconBox.appendChild(img);
  } else {
    iconBox.textContent = achievement.icon;
  }
  
  // 信息
  const infoBox = document.createElement('div');
  infoBox.className = 'badge-info';
  
  const title = document.createElement('div');
  title.className = 'badge-title';
  title.textContent = achievement.name;
  
  const desc = document.createElement('div');
  desc.className = 'badge-desc';
  desc.textContent = achievement.desc;
  
  infoBox.appendChild(title);
  infoBox.appendChild(desc);
  
  // 分类（悬停显示）
  const meta = document.createElement('div');
  meta.className = 'badge-meta';
  meta.textContent = achievement.cat || '';
  
  wrap.appendChild(iconBox);
  wrap.appendChild(infoBox);
  wrap.appendChild(meta);
  card.appendChild(wrap);
  
  // 如果是链接，添加点击事件
  if (isHttp && !isImg) {
    card.style.cursor = 'pointer';
    card.addEventListener('click', () => {
      try {
        window.open(achievement.icon, '_blank');
      } catch (_) {}
    });
  }
  
  container.appendChild(card);
}

/**
 * 渲染成就卡片（按分类分组）
 */
function renderTrophyCards(data, container) {
  const { categories, achievements } = data;
  const styles = ['sakura', 'starry', 'kawaii', 'tech', 'magic', 'violet'];
  const catStyle = {};
  let styleIdx = 0;
  
  // 为每个分类分配样式
  Object.keys(categories).forEach(catName => {
    if (!catStyle[catName]) {
      catStyle[catName] = styles[styleIdx % styles.length];
      styleIdx++;
    }
  });
  
  // 按分类分组成就
  const achievementsByCat = {};
  achievements.forEach(ach => {
    const cat = ach.cat || '未分类';
    if (!achievementsByCat[cat]) {
      achievementsByCat[cat] = [];
    }
    achievementsByCat[cat].push(ach);
  });
  
  container.innerHTML = '';
  
  // 渲染每个分类
  Object.keys(achievementsByCat).forEach(catName => {
    const catAchievements = achievementsByCat[catName];
    const style = catStyle[catName] || styles[0];
    const catDesc = categories[catName] || '';
    
    // 创建分类容器
    const categorySection = document.createElement('section');
    categorySection.className = 'trophy-category-section';
    
    // 渲染分类标牌
    renderCategoryHeader(catName, catDesc, style, categorySection);
    
    // 创建成就容器（按行排列）
    const achievementsContainer = document.createElement('div');
    achievementsContainer.className = 'trophy-achievements-row';
    
    // 渲染该分类下的所有成就
    catAchievements.forEach(ach => {
      renderTrophyCard(ach, style, achievementsContainer);
    });
    
    categorySection.appendChild(achievementsContainer);
    container.appendChild(categorySection);
  });
}

/**
 * 加载成就数据
 */
async function loadTrophies() {
  const mdUrl = '/assets/docs/trophy_list.md';
  try {
    const res = await fetch(mdUrl, { cache: 'no-store' });
    if (!res || !res.ok) {
      console.warn('[Trophy] 无法加载成就列表');
      return [];
    }
    const text = await res.text();
    return parseTrophyMarkdown(text);
  } catch (error) {
    console.warn('[Trophy] 加载成就列表失败:', error);
    return [];
  }
}

/**
 * 确保成就网格容器存在
 */
function ensureTrophyGrid(blankView) {
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
 * 初始化成就页面
 */
export async function initTrophyPage(blankView, pager) {
  if (!blankView) {
    console.warn('[Trophy] blankView 不存在');
    return;
  }
  
  // 确保网格容器存在
  const grid = ensureTrophyGrid(blankView);
  if (!grid) {
    console.warn('[Trophy] 无法创建成就网格');
    return;
  }
  
  __trophyGrid = grid;
  
  // 清空网格，确保每次都能正确显示
  // 注意：这里只清空网格本身，blankView 的清空由 page-manager 负责
  grid.innerHTML = '';
  
  // 如果已经加载过且有内容，直接返回
  if (__trophiesLoaded && grid.children.length > 0) {
    // 确保翻页功能已设置
    UI.setPaginationSource('.blank-view .trophy-grid');
    return;
  }
  
  // 显示加载状态
  if (pager) {
    pager.classList.add('content-loading');
  }
  
  try {
    // 加载成就数据
    const data = await loadTrophies();
    
    if (data.achievements && data.achievements.length > 0) {
      // 渲染成就卡片
      renderTrophyCards(data, grid);
      __trophiesLoaded = true;
      
      // 设置翻页功能
      UI.setPaginationSource('.blank-view .trophy-grid');
    } else {
      grid.innerHTML = '<div style="text-align: center; padding: 40px; color: #999;">暂无成就数据</div>';
    }
  } catch (error) {
    console.error('[Trophy] 初始化失败:', error);
    grid.innerHTML = '<div style="text-align: center; padding: 40px; color: #f00;">加载失败，请刷新重试</div>';
  } finally {
    // 移除加载状态
    if (pager) {
      pager.classList.remove('content-loading');
    }
  }
}

/**
 * 重置成就页面状态（用于重新加载）
 */
export function resetTrophyPage() {
  __trophiesLoaded = false;
  __trophyGrid = null;
}

