/**
 * 成就页面模块
 */

import { qs } from '../utils/utils.js';
import * as UI from '../ui.js';

let __trophiesLoaded = false;
let __trophyGrid = null;

/**
 * 解析 Markdown 格式的成就列表
 */
function parseTrophyMarkdown(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length);
  const stack = [];
  const root = [];
  
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
  
  lines.forEach(raw => {
    const line = raw.trimEnd();
    const ind = parseIndent(raw);
    const content = line.replace(/^[-\s]+/, '');
    const ach = parseAch(content);
    while (stack.length && stack[stack.length - 1].ind >= ind) stack.pop();
    if (ach) {
      const node = { type: 'ach', ind, ...ach, cat: stack.length ? stack[stack.length - 1].name : '' };
      root.push(node);
    } else {
      const node = { type: 'cat', ind, name: content };
      stack.push(node);
    }
  });
  
  return root.filter(n => n.type === 'ach');
}

/**
 * 渲染成就卡片
 */
function renderTrophyCards(achievements, container) {
  const styles = ['sakura', 'starry', 'kawaii', 'tech', 'magic', 'violet'];
  const catStyle = {};
  let styleIdx = 0;
  
  // 为每个分类分配样式
  achievements.forEach(n => {
    const cat = n.cat || 'default';
    if (!catStyle[cat]) {
      catStyle[cat] = styles[styleIdx % styles.length];
      styleIdx++;
    }
  });
  
  container.innerHTML = '';
  
  achievements.forEach(n => {
    const style = catStyle[n.cat || 'default'] || styles[0];
    const card = document.createElement('article');
    card.className = `trophy-card badge-${style}`;
    
    const wrap = document.createElement('div');
    wrap.className = 'badge';
    
    // 图标
    const iconBox = document.createElement('div');
    iconBox.className = 'badge-icon';
    const isHttp = /^https?:\/\//i.test(n.icon);
    const isImg = isHttp && /\.(png|jpg|jpeg|svg|webp)$/i.test(n.icon);
    if (isImg) {
      const img = document.createElement('img');
      img.src = n.icon;
      img.alt = n.name;
      iconBox.appendChild(img);
    } else {
      iconBox.textContent = n.icon;
    }
    
    // 信息
    const infoBox = document.createElement('div');
    infoBox.className = 'badge-info';
    
    const title = document.createElement('div');
    title.className = 'badge-title';
    title.textContent = n.name;
    
    const desc = document.createElement('div');
    desc.className = 'badge-desc';
    desc.textContent = n.desc;
    
    infoBox.appendChild(title);
    infoBox.appendChild(desc);
    
    // 分类
    const meta = document.createElement('div');
    meta.className = 'badge-meta';
    meta.textContent = n.cat || '';
    
    wrap.appendChild(iconBox);
    wrap.appendChild(infoBox);
    wrap.appendChild(meta);
    card.appendChild(wrap);
    
    // 如果是链接，添加点击事件
    if (isHttp && !isImg) {
      card.style.cursor = 'pointer';
      card.addEventListener('click', () => {
        try {
          window.open(n.icon, '_blank');
        } catch (_) {}
      });
    }
    
    container.appendChild(card);
  });
}

/**
 * 加载成就数据
 */
async function loadTrophies() {
  const mdUrl = '../assets/docs/trophy_list.md';
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
    const achievements = await loadTrophies();
    
    if (achievements.length > 0) {
      // 渲染成就卡片
      renderTrophyCards(achievements, grid);
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

