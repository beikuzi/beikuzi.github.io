/**
 * 友链页面模块
 */

import { qs } from '../utils/utils.js';

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
 * 渲染友链列表
 */
function renderFriendsList(friends, container) {
  container.innerHTML = '';
  
  if (friends.length === 0) {
    container.innerHTML = '<div style="text-align: center; padding: 40px; color: #999;">暂无友链数据</div>';
    return;
  }
  
  friends.forEach(friend => {
    const item = document.createElement('div');
    item.className = 'friend-item';
    
    const link = document.createElement('a');
    link.href = friend.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = friend.title;
    link.className = 'friend-link';
    
    item.appendChild(link);
    container.appendChild(item);
  });
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
    } else {
      console.warn('[Friends] 没有找到友链数据');
      container.innerHTML = '<div style="text-align: center; padding: 40px; color: #999;">暂无友链数据</div>';
    }
  } catch (error) {
    console.error('[Friends] 初始化失败:', error);
    container.innerHTML = '<div style="text-align: center; padding: 40px; color: #f00;">加载失败，请刷新重试</div>';
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

