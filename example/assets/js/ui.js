/**
 * UI 交互控制
 */

import { qs, qsa } from './utils/utils.js';

// ============================================
// 侧边栏控制
// ============================================

let resizeStartX = null;
let resizeStartWidth = null;
let onResizeMove = null;
let onResizeUp = null;

// 设置侧边栏宽度
export const setSidebarWidth = (width) => {
  const value = typeof width === 'number' ? `${width}px` : width;
  document.documentElement.style.setProperty('--sidebar-width', value);
  
  try {
    localStorage.setItem('sidebarWidth', value);
  } catch (e) {}
};

// 切换侧边栏
export const toggleSidebar = () => {
  const sidebar = qs('.sidebar');
  const mask = qs('.mask');
  const edgeBtn = qs('.sidebar-edge');
  const bottomToggle = qs('.bottom-tools .toggle-sidebar');
  
  if (!sidebar) return;
  
  sidebar.classList.toggle('open');
  
  const isMobile = window.innerWidth <= 1024;
  if (mask && isMobile) {
    mask.classList.toggle('show', sidebar.classList.contains('open'));
  }
  
  if (edgeBtn) {
    edgeBtn.textContent = sidebar.classList.contains('open') ? '‹' : '›';
  }
  if (bottomToggle) {
    bottomToggle.classList.toggle('closed', !sidebar.classList.contains('open'));
  }
};

// 初始化侧边栏调整大小
export const initSidebarResize = () => {
  const resizer = qs('.sidebar-resizer');
  const sidebar = qs('.sidebar');
  
  if (!resizer || !sidebar) return;
  
  resizer.addEventListener('mousedown', (e) => {
    const isMobile = window.innerWidth <= 1024;
    if (isMobile) return;
    
    resizeStartX = e.clientX;
    resizeStartWidth = sidebar.getBoundingClientRect().width;
    document.body.style.cursor = 'col-resize';
    document.body.classList.add('resizing');
    
    onResizeMove = (ev) => {
      const dx = ev.clientX - resizeStartX;
      let newWidth = resizeStartWidth + dx;
      newWidth = Math.max(160, Math.min(560, newWidth));
      setSidebarWidth(newWidth);
    };
    
    onResizeUp = () => {
      document.body.style.cursor = '';
      document.body.classList.remove('resizing');
      window.removeEventListener('mousemove', onResizeMove);
      window.removeEventListener('mouseup', onResizeUp);
    };
    
    window.addEventListener('mousemove', onResizeMove);
    window.addEventListener('mouseup', onResizeUp);
  });
};

// ============================================
// 主题切换
// ============================================

// 切换暗色模式
export const toggleDarkMode = () => {
  const isDark = document.body.classList.toggle('dark');
  
  // 移除所有主题变体
  document.body.classList.remove(
    'dark-theme-soft',
    'dark-theme-forest',
    'dark-theme-violet'
  );
  
  // 如果开启暗色模式，应用默认变体
  if (isDark) {
    document.body.classList.add('dark-theme-forest');
  }
  
  try {
    localStorage.setItem('darkMode', isDark ? '1' : '0');
  } catch (e) {}
};

// 设置暗色主题变体
export const setDarkThemeVariant = (variant) => {
  const variants = ['soft', 'forest', 'violet'];
  if (!variants.includes(variant)) return;
  
  document.body.classList.remove(
    'dark-theme-soft',
    'dark-theme-forest',
    'dark-theme-violet'
  );
  
  document.body.classList.add(`dark-theme-${variant}`);
  
  try {
    localStorage.setItem('darkThemeVariant', variant);
  } catch (e) {}
};

// ============================================
// 卡片悬停效果
// ============================================

let currentCardEffect = 'none';
let tiltMove = null;
let tiltEnter = null;
let tiltLeave = null;

// 清除卡片效果
const clearCardEffects = () => {
  const cards = qsa('.card');
  if (!cards.length) return;
  
  cards.forEach(card => {
    if (tiltMove) card.removeEventListener('mousemove', tiltMove);
    if (tiltEnter) card.removeEventListener('mouseenter', tiltEnter);
    if (tiltLeave) card.removeEventListener('mouseleave', tiltLeave);
    card.style.transform = '';
    card.style.transition = '';
  });
};

// 设置卡片悬停效果
export const setCardHoverEffect = (effect) => {
  clearCardEffects();
  
  const content = qs('.content');
  if (!content) {
    // 如果 content 还没加载，延迟执行
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => setCardHoverEffect(effect));
      return;
    }
    return;
  }
  
  content.classList.remove(
    'card-effect-none',
    'card-effect-lift',
    'card-effect-zoom',
    'card-effect-glow',
    'card-effect-tilt'
  );
  
  currentCardEffect = effect;
  content.classList.add(`card-effect-${effect}`);
  
  // 3D 倾斜效果需要特殊处理
  if (effect === 'tilt') {
    const cards = qsa('.card');
    
    tiltEnter = (e) => {
      e.currentTarget.style.transition = 'transform 0.06s linear';
    };
    
    tiltMove = (e) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      const rotateX = (0.5 - y) * 8;
      const rotateY = (x - 0.5) * 10;
      e.currentTarget.style.transform = 
        `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    };
    
    tiltLeave = (e) => {
      e.currentTarget.style.transition = 'transform .25s ease';
      e.currentTarget.style.transform = '';
    };
    
    cards.forEach(card => {
      card.addEventListener('mouseenter', tiltEnter);
      card.addEventListener('mousemove', tiltMove);
      card.addEventListener('mouseleave', tiltLeave);
    });
  }
};

// ============================================
// 网格布局自适应
// ============================================

import { gridConfig } from './config.js';

export const adjustGridLayout = () => {
  const grid = qs('.grid');
  if (!grid) return;
  const cs0 = getComputedStyle(grid);
  if (cs0.display === 'none' || grid.clientWidth <= 0) return;
  
  // 确保最小间距
  const computedStyle = cs0;
  const currentGap = parseFloat(cs0.gap) || 0;
  if (currentGap < gridConfig.gapPx) {
    grid.style.setProperty('--grid-gap', `${gridConfig.gapPx}px`);
  }
  
  // 计算最佳列数
  const width = grid.clientWidth;
  const gap = parseFloat(cs0.gap) || gridConfig.gapPx;
  let cols = parseInt(computedStyle.getPropertyValue('--grid-cols')) || 4;
  
  const { minRatio, maxRatio } = gridConfig;
  let tries = 0;
  
  while (tries < 12) {
    const cardWidth = (width - (cols - 1) * gap) / cols;
    const ratio = gap / cardWidth;
    
    if (ratio > maxRatio) {
      if (cols > gridConfig.minCols) cols--;
      else break;
    } else if (ratio < minRatio) {
      if (cols < gridConfig.maxCols) cols++;
      else break;
    } else {
      break;
    }
    tries++;
  }
  
  cols = Math.max(gridConfig.minCols, Math.min(gridConfig.maxCols, cols));
  grid.style.setProperty('--grid-cols', String(cols));
};

// 初始化网格布局
export const initGridLayout = () => {
  adjustGridLayout();
  window.addEventListener('resize', adjustGridLayout);
};

export const initAvatarPopover = () => {
  let wrap = qs('.avatar-wrap');
  let avatar = wrap ? wrap.querySelector('.avatar') : qs('.title .avatar');
  if (avatar && !wrap) {
    wrap = document.createElement('span');
    wrap.className = 'avatar-wrap';
    avatar.parentNode.insertBefore(wrap, avatar);
    wrap.appendChild(avatar);
  }
  if (!wrap || !avatar) return;
  let pop = document.getElementById('avatar-pop');
  if (!pop) {
    pop = document.createElement('div');
    pop.id = 'avatar-pop';
    pop.className = 'avatar-pop';
    const large = document.createElement('img');
    large.className = 'avatar-large';
    large.src = avatar.getAttribute('src') || '';
    pop.appendChild(large);
    const actions = document.createElement('div');
    actions.className = 'avatar-actions';
    const btn = document.createElement('button');
    btn.className = 'avatar-btn like-btn';
    const countEl = document.createElement('span');
    countEl.className = 'like-count';
    let count = 0;
    try { const saved = localStorage.getItem('avatarLikes'); if (saved) count = parseInt(saved) || 0; } catch (_) {}
    let liked = false;
    try { liked = localStorage.getItem('avatarLiked') === '1'; } catch (_) {}
    countEl.textContent = String(count);
    btn.setAttribute('aria-pressed', liked ? 'true' : 'false');
    if (liked) btn.classList.add('active');
    btn.textContent = '👍 ';
    btn.appendChild(countEl);
    actions.appendChild(btn);
    pop.appendChild(actions);
    btn.addEventListener('click', () => {
      liked = !liked;
      btn.classList.toggle('active', liked);
      btn.setAttribute('aria-pressed', liked ? 'true' : 'false');
      count = liked ? count + 1 : Math.max(0, count - 1);
      countEl.textContent = String(count);
      try {
        localStorage.setItem('avatarLikes', String(count));
        localStorage.setItem('avatarLiked', liked ? '1' : '0');
      } catch (_) {}
    });
    wrap.appendChild(pop);
  } else {
    const large = pop.querySelector('.avatar-large');
    if (large && avatar && avatar.getAttribute('src')) large.src = avatar.getAttribute('src');
  }
  let t = null;
  const show = () => { if (t) { clearTimeout(t); t = null; } pop.classList.add('show'); };
  const schedule = () => { if (t) clearTimeout(t); t = setTimeout(() => { const hovered = wrap.matches(':hover') || pop.matches(':hover'); if (!hovered) pop.classList.remove('show'); }, 120); };
  wrap.addEventListener('mouseenter', show);
  pop.addEventListener('mouseenter', show);
  wrap.addEventListener('mouseleave', schedule);
  pop.addEventListener('mouseleave', schedule);
  document.addEventListener('click', (e) => { if (pop.classList.contains('show') && !wrap.contains(e.target)) pop.classList.remove('show'); });
};

// 应用逐行刷新效果到指定的卡片列表
const applyRowFallEffect = (cards) => {
  if (!cards || cards.length === 0) return;
  const first = cards[0];
  const grid = first ? first.closest('.grid, .trophy-grid') : qs('.grid');
  if (!grid) return;
  
  // 获取列数
  const cs = getComputedStyle(grid);
  let cols = parseInt(cs.getPropertyValue('--grid-cols')) || 4;
  const gap = parseFloat(cs.gap) || 36;
  if (!cols || cols <= 0) {
    const w = grid.clientWidth;
    const cardW = cards[0] ? cards[0].getBoundingClientRect().width : 260;
    cols = Math.max(1, Math.floor((w + gap) / (cardW + gap)));
  }
  
  // 清理之前的动画状态
  cards.forEach(c => {
    c.classList.remove('card-row-enter');
    c.style.opacity = '0';
    c.style.transform = 'translateY(-24px)';
  });
  
  // 等待一帧确保DOM更新完成
  requestAnimationFrame(() => {
    // 按卡片在网格中的实际位置（top坐标）分组
    const cardPositions = cards.map(card => {
      const rect = card.getBoundingClientRect();
      const gridRect = grid.getBoundingClientRect();
      return {
        card,
        top: rect.top - gridRect.top
      };
    });
    
    // 按top坐标排序并分组（相同行的卡片top坐标相近）
    cardPositions.sort((a, b) => a.top - b.top);
    
    const rows = [];
    let currentRow = [];
    let lastTop = null;
    const rowTolerance = 10; // 允许的垂直位置误差（像素）
    
    cardPositions.forEach(({ card, top }) => {
      if (lastTop === null || Math.abs(top - lastTop) > rowTolerance) {
        // 新的一行
        if (currentRow.length > 0) {
          rows.push(currentRow);
        }
        currentRow = [card];
        lastTop = top;
      } else {
        // 同一行
        currentRow.push(card);
      }
    });
    
    // 添加最后一行
    if (currentRow.length > 0) {
      rows.push(currentRow);
    }
    
    // 逐行应用动画
    rows.forEach((row, rIdx) => {
      const delay = rIdx * 90;
      setTimeout(() => {
        row.forEach(c => {
          c.classList.add('card-row-enter');
          c.style.opacity = '';
          c.style.transform = '';
        });
      }, delay);
    });
  });
};

export const enableRowFallEffect = () => {
  const grid = qs('.grid');
  if (!grid) return;
  let cards = [...grid.querySelectorAll('.card')];
  if (!cards.length) {
    const n = 24;
    for (let i = 0; i < n; i++) {
      const d = document.createElement('div');
      d.className = 'card';
      grid.appendChild(d);
    }
    cards = [...grid.querySelectorAll('.card')];
  }
  // 使用通用的逐行刷新函数
  applyRowFallEffect(cards);
};

export const addDemoCards = (count = 36) => {
  const grid = qs('.grid');
  if (!grid) return;
  if (grid.dataset.demoLoaded === '1') return;
  const rand = () => Math.floor(180 + Math.random() * 60);
  for (let i = 0; i < count; i++) {
    const card = document.createElement('article');
    card.className = 'card';
    const banner = document.createElement('div');
    banner.className = 'card-banner';
    const c1 = rand();
    const c2 = rand();
    banner.style.backgroundImage = `linear-gradient(135deg, rgba(${c1},${rand()},${rand()},.35), rgba(${rand()},${c2},${rand()},.35))`;
    const body = document.createElement('div');
    body.className = 'card-body';
    const title = document.createElement('div');
    title.className = 'card-title';
    title.textContent = `示例卡片 ${i + 1}`;
    const text = document.createElement('div');
    text.textContent = '这是一段示例内容，用于验证整行下落动效与网格布局。';
    body.appendChild(title);
    body.appendChild(text);
    card.appendChild(banner);
    card.appendChild(body);
    grid.appendChild(card);
  }
  grid.dataset.demoLoaded = '1';
};

// ============================================
// 翻页功能
// ============================================

let __paginationState = {
  containerSel: '.grid',
  containerEl: null,
  prev: null,
  next: null,
  sizeSel: null,
  pageSel: null,
  totalText: null,
  pageSize: 12,
  total: 1,
  current: 1,
  observer: null,
  listenersInitialized: false
};

const __getItems = () => {
  const el = __paginationState.containerEl;
  if (!el) return [];
  return [...el.querySelectorAll('.card, .trophy-card')];
};

const __renderSelect = () => {
  const { pageSel, totalText, total, current } = __paginationState;
  if (!pageSel || !totalText) return;
  pageSel.innerHTML = '';
  for (let i = 1; i <= total; i++) {
    const option = document.createElement('option');
    option.value = String(i);
    option.textContent = String(i);
    pageSel.appendChild(option);
  }
  pageSel.value = String(current);
  totalText.textContent = `/ 共 ${total} 页`;
};

const __updateTotals = () => {
  const items = __getItems();
  __paginationState.total = Math.max(1, Math.ceil(items.length / __paginationState.pageSize));
  if (__paginationState.current > __paginationState.total) __paginationState.current = __paginationState.total;
};

const __renderPage = () => {
  const items = __getItems();
  __updateTotals();
  const start = (__paginationState.current - 1) * __paginationState.pageSize;
  const end = start + __paginationState.pageSize;
  items.forEach((it) => {
    it.style.display = 'none';
    it.classList.remove('card-row-enter');
  });
  const visible = items.slice(start, end);
  visible.forEach((it) => { it.style.display = ''; });
  __renderSelect();
  if (__paginationState.prev) __paginationState.prev.disabled = __paginationState.current <= 1;
  if (__paginationState.next) __paginationState.next.disabled = __paginationState.current >= __paginationState.total;
  requestAnimationFrame(() => { applyRowFallEffect(visible); });
};

export const setPaginationSource = (selector) => {
  __paginationState.containerSel = selector || '.grid';
  __paginationState.containerEl = qs(__paginationState.containerSel);
  __paginationState.current = 1;
  
  // 如果翻页功能还未初始化，先初始化必要的元素
  if (!__paginationState.prev || !__paginationState.next || !__paginationState.sizeSel || !__paginationState.pageSel || !__paginationState.totalText) {
    __paginationState.prev = qs('.page-prev');
    __paginationState.next = qs('.page-next');
    __paginationState.sizeSel = qs('.page-size');
    __paginationState.pageSel = qs('.page-select');
    __paginationState.totalText = qs('.page-total');
  }
  
  // 如果找到了所有必要的元素且事件监听器还未初始化，初始化事件监听器
  if (!__paginationState.listenersInitialized && __paginationState.prev && __paginationState.next && __paginationState.sizeSel && __paginationState.pageSel && __paginationState.totalText) {
    __paginationState.pageSize = parseInt(__paginationState.sizeSel.value) || 12;
    __paginationState.prev.addEventListener('click', () => { if (__paginationState.current > 1) { __paginationState.current--; __renderPage(); } });
    __paginationState.next.addEventListener('click', () => { if (__paginationState.current < __paginationState.total) { __paginationState.current++; __renderPage(); } });
    __paginationState.sizeSel.addEventListener('change', () => { __paginationState.pageSize = parseInt(__paginationState.sizeSel.value) || 12; __paginationState.current = 1; __renderPage(); });
    __paginationState.pageSel.addEventListener('change', () => { const newPage = parseInt(__paginationState.pageSel.value) || 1; if (newPage >= 1 && newPage <= __paginationState.total) { __paginationState.current = newPage; __renderPage(); } });
    __paginationState.listenersInitialized = true;
  }
  
  __renderPage();
  if (__paginationState.observer) {
    __paginationState.observer.disconnect();
    __paginationState.observer = null;
  }
  if (__paginationState.containerEl) {
    __paginationState.observer = new MutationObserver(() => { __renderPage(); });
    __paginationState.observer.observe(__paginationState.containerEl, { childList: true, subtree: false });
  }
};

export const initPagination = () => {
  __paginationState.containerEl = qs(__paginationState.containerSel);
  __paginationState.prev = qs('.page-prev');
  __paginationState.next = qs('.page-next');
  __paginationState.sizeSel = qs('.page-size');
  __paginationState.pageSel = qs('.page-select');
  __paginationState.totalText = qs('.page-total');
  if (!__paginationState.containerEl || !__paginationState.prev || !__paginationState.next || !__paginationState.sizeSel || !__paginationState.pageSel || !__paginationState.totalText) return;
  __paginationState.pageSize = parseInt(__paginationState.sizeSel.value) || 12;
  __renderPage();
  
  // 如果事件监听器还未初始化，才绑定
  if (!__paginationState.listenersInitialized) {
    __paginationState.prev.addEventListener('click', () => { if (__paginationState.current > 1) { __paginationState.current--; __renderPage(); } });
    __paginationState.next.addEventListener('click', () => { if (__paginationState.current < __paginationState.total) { __paginationState.current++; __renderPage(); } });
    __paginationState.sizeSel.addEventListener('change', () => { __paginationState.pageSize = parseInt(__paginationState.sizeSel.value) || 12; __paginationState.current = 1; __renderPage(); });
    __paginationState.pageSel.addEventListener('change', () => { const newPage = parseInt(__paginationState.pageSel.value) || 1; if (newPage >= 1 && newPage <= __paginationState.total) { __paginationState.current = newPage; __renderPage(); } });
    __paginationState.listenersInitialized = true;
  }
  
  if (__paginationState.observer) { __paginationState.observer.disconnect(); }
  __paginationState.observer = new MutationObserver(() => { __renderPage(); });
  __paginationState.observer.observe(__paginationState.containerEl, { childList: true, subtree: false });
};
