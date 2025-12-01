/**
 * 友链页面模块
 */

import { qs } from '../utils/utils.js';
import * as UI from '../ui.js';

let __friendsLoaded = false;
let __friendsContainer = null;

/**
 * 解析 Markdown 格式的友链列表
 * 格式: [博客标题名](超链接)
 */
function parseFriendsMarkdown(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length);
  const friends = [];
  
  // 匹配 markdown 链接格式: [标题](URL)
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/;
  
  lines.forEach(line => {
    const trimmed = line.trim();
    const match = trimmed.match(linkRegex);
    if (match) {
      const title = match[1].trim();
      let url = match[2].trim();
      
      // 如果 URL 没有协议，添加 https://
      if (url && !/^https?:\/\//i.test(url)) {
        url = `https://${url}`;
      }
      
      if (title && url) {
        friends.push({ title, url });
      }
    }
  });
  
  return friends;
}

/**
 * 加载友链数据
 */
async function loadFriends() {
  const mdUrl = '/assets/docs/friends_list.md';
  try {
    const res = await fetch(mdUrl, { cache: 'no-store' });
    if (!res || !res.ok) {
      console.warn('[Friends] 无法加载友链列表');
      return [];
    }
    const text = await res.text();
    return parseFriendsMarkdown(text);
  } catch (error) {
    console.warn('[Friends] 加载友链列表失败:', error);
    return [];
  }
}

/**
 * 确保友链容器存在
 */
function ensureFriendsContainer(blankView) {
  if (!blankView) return null;
  
  let container = blankView.querySelector('.friends-list');
  if (!container) {
    container = document.createElement('section');
    container.className = 'friends-list';
    blankView.appendChild(container);
  }
  return container;
}

/**
 * 获取友链的域名（用于显示）
 */
function getDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * 生成随机二次元风格图标
 */
function getRandomIcon() {
  const icons = ['🌸', '✨', '💫', '⭐', '🎀', '🎈', '🎁', '🌺', '🌷', '🌻', '🌼', '🦋', '🐰', '🐱', '🦄',];
  return icons[Math.floor(Math.random() * icons.length)];
}

/**
 * 生成随机渐变样式类
 */
function getRandomGradientClass(index) {
  const gradients = ['friend-gradient-1', 'friend-gradient-2', 'friend-gradient-3', 'friend-gradient-4', 'friend-gradient-5', 'friend-gradient-6'];
  return gradients[index % gradients.length];
}

/**
 * 渲染友链列表
 */
function renderFriendsList(friends, container) {
  container.innerHTML = '';
  
  if (friends.length === 0) {
    container.innerHTML = `
      <div class="friends-empty">
        <div class="friends-empty-icon">💔</div>
        <div class="friends-empty-text">暂无友链数据</div>
        <div class="friends-empty-hint">快来添加第一个友链吧~</div>
      </div>
    `;
    return;
  }
  
  // 添加标题
  const header = document.createElement('div');
  header.className = 'friends-header';
  header.innerHTML = `
    <div class="friends-header-icon">💫</div>
    <div class="friends-header-content">
      <h2 class="friends-header-title">友链小窝</h2>
      <p class="friends-header-subtitle">和朋友们一起分享美好的时光~</p>
    </div>
  `;
  container.appendChild(header);
  
  // 创建网格容器
  const grid = document.createElement('div');
  grid.className = 'friends-grid';
  
  friends.forEach((friend, index) => {
    const card = document.createElement('article');
    card.className = `friend-card ${getRandomGradientClass(index)}`;
    
    // 添加延迟动画
    card.style.animationDelay = `${index * 0.1}s`;
    
    const icon = getRandomIcon();
    const domain = getDomain(friend.url);
    
    card.innerHTML = `
      <div class="friend-card-bg"></div>
      <div class="friend-card-content">
        <div class="friend-card-icon">${icon}</div>
        <div class="friend-card-info">
          <h3 class="friend-card-title">${friend.title}</h3>
          <p class="friend-card-domain">${domain}</p>
        </div>
        <div class="friend-card-arrow">→</div>
      </div>
      <a href="${friend.url}" target="_blank" rel="noopener noreferrer" class="friend-card-link" aria-label="访问 ${friend.title}"></a>
    `;
    
    grid.appendChild(card);
  });
  
  container.appendChild(grid);
}

/**
 * 初始化友链页面
 */
export async function initFriendsPage(blankView, pager) {
  console.log('[Friends] 初始化友链页面', { blankView, pager });
  
  if (!blankView) {
    console.error('[Friends] blankView 不存在');
    return;
  }
  
  // 确保容器存在
  const container = ensureFriendsContainer(blankView);
  if (!container) {
    console.error('[Friends] 无法创建友链容器');
    return;
  }
  
  __friendsContainer = container;
  
  // 清空容器，确保每次都能正确显示
  // 注意：这里只清空容器本身，blankView 的清空由 page-manager 负责
  container.innerHTML = '';
  
  // 如果已经加载过且有内容，直接返回（但先清空，确保状态正确）
  // 注释掉这个检查，确保每次都能重新加载
  // if (__friendsLoaded && container.children.length > 0) {
  //   console.log('[Friends] 友链已加载，跳过重新加载');
  //   return;
  // }
  
  // 显示加载状态
  if (pager) {
    pager.classList.add('content-loading');
  }
  
  try {
    // 加载友链数据
    console.log('[Friends] 开始加载友链数据...');
    const friends = await loadFriends();
    console.log('[Friends] 加载到的友链数量:', friends.length, friends);
    
    if (friends.length > 0) {
      // 渲染友链列表
      renderFriendsList(friends, container);
      __friendsLoaded = true;
      console.log('[Friends] 友链列表渲染完成');
      
      // 设置翻页源为友链列表容器
      UI.setPaginationSource('.friends-list');
    } else {
      console.warn('[Friends] 没有找到友链数据');
      container.innerHTML = `
        <div class="friends-empty">
          <div class="friends-empty-icon">💔</div>
          <div class="friends-empty-text">暂无友链数据</div>
          <div class="friends-empty-hint">快来添加第一个友链吧~</div>
        </div>
      `;
    }
  } catch (error) {
    console.error('[Friends] 初始化失败:', error);
    container.innerHTML = `
      <div class="friends-empty">
        <div class="friends-empty-icon">😢</div>
        <div class="friends-empty-text">加载失败</div>
        <div class="friends-empty-hint">请刷新重试~</div>
      </div>
    `;
  } finally {
    // 移除加载状态
    if (pager) {
      pager.classList.remove('content-loading');
    }
  }
}

/**
 * 重置友链页面状态（用于重新加载）
 */
export function resetFriendsPage() {
  __friendsLoaded = false;
  if (__friendsContainer) {
    __friendsContainer.innerHTML = '';
  }
}

