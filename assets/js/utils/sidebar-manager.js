/**
 * 主侧边栏管理器
 * 用于根据当前页面动态更新左侧边栏（.sidebar）的内容
 */

import { qs } from './utils.js';
import { loadConfig } from '../config.js';

let currentObserver = null;
let activeLinkId = null;
let scrollConfig = { offset: 80, bottomPadding: 200 };
let updateDebounceTimer = null;
let isUserScrolling = false;
let highlightTimers = new Map(); // 存储每个元素的高亮定时器

// 加载滚动配置
(async () => {
  const config = await loadConfig();
  if (config && config.sidebar) {
    if (config.sidebar.scrollOffset !== undefined) {
      scrollConfig.offset = config.sidebar.scrollOffset;
    }
    if (config.sidebar.bottomPadding !== undefined) {
      scrollConfig.bottomPadding = config.sidebar.bottomPadding;
    }
  }
})();

/**
 * 高亮闪烁特效
 */
function highlightElement(element) {
  if (!element) return;
  
  const elementId = element.id || Math.random().toString(36);
  
  // 清除该元素之前的定时器和事件监听器
  if (highlightTimers.has(elementId)) {
    clearTimeout(highlightTimers.get(elementId));
    highlightTimers.delete(elementId);
  }
  
  // 移除之前的事件监听器
  if (element._highlightAnimationHandler) {
    element.removeEventListener('animationend', element._highlightAnimationHandler);
    element._highlightAnimationHandler = null;
  }
  
  // 先移除旧的高亮类
  element.classList.remove('sidebar-highlight');
  
  // 强制浏览器重新计算样式（触发 reflow）
  void element.offsetWidth;
  
  // 添加高亮类
  element.classList.add('sidebar-highlight');
  
  // 使用 animationend 事件监听动画结束，避免定时器与动画不同步导致闪烁
  const handleAnimationEnd = (e) => {
    // 只处理 sidebarPulse 动画结束（这是最长的动画）
    if (e.animationName === 'sidebarPulse') {
      element.removeEventListener('animationend', handleAnimationEnd);
      element._highlightAnimationHandler = null;
      highlightTimers.delete(elementId);
      
      // 使用 requestAnimationFrame 确保在下一帧移除类，避免闪烁
      requestAnimationFrame(() => {
        element.classList.remove('sidebar-highlight');
      });
    }
  };
  
  element._highlightAnimationHandler = handleAnimationEnd;
  element.addEventListener('animationend', handleAnimationEnd);
  
  // 备用定时器：如果 animationend 事件没有触发，确保类最终被移除
  const timerId = setTimeout(() => {
    if (element._highlightAnimationHandler) {
      element.removeEventListener('animationend', element._highlightAnimationHandler);
      element._highlightAnimationHandler = null;
    }
    element.classList.remove('sidebar-highlight');
    highlightTimers.delete(elementId);
  }, 1500); // 比最长动画多 300ms 作为安全余量
  
  highlightTimers.set(elementId, timerId);
}

/**
 * 获取滚动容器（.page 元素）
 */
function getScrollContainer() {
  return document.querySelector('.page') || document.documentElement;
}

/**
 * 智能滚动定位到目标元素
 * 考虑响应式布局，确保目标元素在视口中可见
 */
function scrollToElement(element, offset = null) {
  if (!element) return;
  
  const scrollContainer = getScrollContainer();
  const scrollOffset = offset !== null ? offset : scrollConfig.offset;
  
  // 获取目标元素相对于滚动容器的位置
  const containerRect = scrollContainer.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();
  
  // 计算需要滚动的位置
  const currentScroll = scrollContainer.scrollTop;
  const elementTop = elementRect.top - containerRect.top + currentScroll;
  const targetPosition = elementTop - scrollOffset;
  
  scrollContainer.scrollTo({
    top: Math.max(0, targetPosition),
    behavior: 'smooth'
  });
}

/**
 * 更新活动链接
 * @param {string} id - 要激活的链接 ID
 * @param {boolean} autoExpand - 是否自动展开父分类（默认 false，滚动时不展开）
 */
function updateActiveLink(id, autoExpand = false) {
  if (activeLinkId === id) return;
  
  const sidebar = qs('.sidebar');
  if (!sidebar) return;
  
  // 移除之前的活动状态
  if (activeLinkId) {
    const prevLink = sidebar.querySelector(`[data-target="${activeLinkId}"]`);
    if (prevLink) {
      prevLink.classList.remove('active');
    }
  }
  
  // 添加新的活动状态
  activeLinkId = id;
  const link = sidebar.querySelector(`[data-target="${id}"]`);
  if (link) {
    link.classList.add('active');
    
    // 只有在用户主动点击时才展开父分类，滚动时不自动展开
    if (autoExpand) {
      const cat = link.closest('.cat');
      if (cat && !cat.classList.contains('open')) {
        cat.classList.add('open');
      }
    }
  }
}

/**
 * 防抖更新活动链接（避免滚动时乱闪）
 */
function debouncedUpdateActiveLink(id) {
  // 如果是用户主动点击触发的滚动，暂时禁用自动更新
  if (isUserScrolling) return;
  
  // 清除之前的定时器
  if (updateDebounceTimer) {
    clearTimeout(updateDebounceTimer);
  }
  
  // 延迟更新，等待滚动稳定
  updateDebounceTimer = setTimeout(() => {
    updateActiveLink(id);
  }, 150);
}

/**
 * 设置 Intersection Observer 来跟踪可见的章节
 * 跟踪子项，使用防抖避免滚动时乱闪
 */
function setupIntersectionObserver(items) {
  // 清理旧的 observer
  if (currentObserver) {
    currentObserver.disconnect();
  }
  
  // 收集所有子项元素
  const targets = [];
  items.forEach(item => {
    // 收集子项
    if (item.children && item.children.length > 0) {
      item.children.forEach(child => {
        if (child.id) {
          const element = document.getElementById(child.id);
          if (element) {
            targets.push({ id: child.id, element });
          }
        }
      });
    }
  });
  
  if (targets.length === 0) return;
  
  // 获取滚动容器作为 Observer 的 root
  const scrollContainer = document.querySelector('.page');
  
  // 创建 Intersection Observer
  currentObserver = new IntersectionObserver(
    (entries) => {
      // 找到最接近顶部的可见元素
      let closestEntry = null;
      let closestDistance = Infinity;
      
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const rect = entry.boundingClientRect;
          const distance = Math.abs(rect.top - 150); // 150px 是顶部偏移
          
          if (distance < closestDistance) {
            closestDistance = distance;
            closestEntry = entry;
          }
        }
      });
      
      if (closestEntry) {
        const id = closestEntry.target.id;
        // 使用防抖更新，避免滚动时乱闪
        debouncedUpdateActiveLink(id);
      }
    },
    {
      root: scrollContainer,
      rootMargin: '-80px 0px -60% 0px',
      threshold: [0, 0.25, 0.5]
    }
  );
  
  // 观察所有子项元素
  targets.forEach(({ element }) => {
    currentObserver.observe(element);
  });
}

/**
 * 创建分类项
 */
function createCategory(catData, catIndex) {
  const catDiv = document.createElement('div');
  catDiv.className = 'cat open';
  
  const toggle = document.createElement('button');
  toggle.className = 'cat-toggle';
  
  const icon = document.createElement('span');
  icon.className = 'icon';
  // 如果图标是 emoji 或特殊字符，直接显示；否则显示字母
  const iconText = catData.icon || String.fromCharCode(65 + catIndex); // A, B, C...
  icon.textContent = iconText;
  
  const name = document.createElement('span');
  name.textContent = catData.name;
  
  const arrow = document.createElement('span');
  arrow.className = 'arrow';
  arrow.textContent = '›';
  
  toggle.appendChild(icon);
  toggle.appendChild(name);
  toggle.appendChild(arrow);
  
  const itemsDiv = document.createElement('div');
  itemsDiv.className = 'cat-items';
  
  // 如果有子项，创建子项
  if (catData.children && catData.children.length > 0) {
    catData.children.forEach(child => {
      const itemDiv = document.createElement('div');
      itemDiv.className = 'cat-item';
      
      const link = document.createElement('a');
      link.href = `#${child.id}`;
      link.textContent = child.name;
      link.setAttribute('data-target', child.id);
      
      // 如果是文章导航链接（有 articleTitle 属性），跳转到文章页面
      if (child.articleTitle) {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          window.location.hash = `#article_${encodeURIComponent(child.articleTitle)}`;
        });
      } else {
        // 普通链接（如目录），滚动到页面内位置
        link.addEventListener('click', (e) => {
          e.preventDefault();
          const target = document.getElementById(child.id);
          if (target) {
            // 暂时禁用自动更新，避免滚动时乱闪
            isUserScrolling = true;
            
            // 滚动到目标位置并高亮
            scrollToElement(target);
            highlightElement(target);
            updateActiveLink(child.id, true); // 用户点击时展开分类
            
            // 滚动完成后恢复自动更新
            setTimeout(() => {
              isUserScrolling = false;
            }, 800);
          }
        });
      }
      
      // 如果是当前文章，添加特殊样式
      if (child.isCurrent) {
        link.classList.add('active');
      }
      
      itemDiv.appendChild(link);
      itemsDiv.appendChild(itemDiv);
    });
    
    // 点击分类标题：切换展开/折叠
    toggle.addEventListener('click', (e) => {
      // 如果点击的是箭头，只切换展开/折叠
      if (e.target.classList.contains('arrow')) {
        catDiv.classList.toggle('open');
        return;
      }
      
      // 点击标题文字：切换折叠并跳转到分类位置
      catDiv.classList.toggle('open');
      
      if (catData.id) {
        const target = document.getElementById(catData.id);
        if (target) {
          // 暂时禁用自动更新，避免滚动时干扰
          isUserScrolling = true;
          
          // 滚动到分类标题位置
          scrollToElement(target);
          highlightElement(target);
          
          // 滚动完成后恢复自动更新
          setTimeout(() => {
            isUserScrolling = false;
          }, 800);
        }
      }
    });
    
    // 如果分类有ID，也设置data-target以便Intersection Observer可以跟踪
    if (catData.id) {
      toggle.setAttribute('data-target', catData.id);
    }
  } else if (catData.id) {
    // 如果没有子项但有 ID，点击分类本身可以跳转
    toggle.setAttribute('data-target', catData.id);
    toggle.addEventListener('click', (e) => {
      // 阻止默认的展开/折叠行为
      e.stopPropagation();
      const target = document.getElementById(catData.id);
      if (target) {
        // 暂时禁用自动更新，避免滚动时乱闪
        isUserScrolling = true;
        
        // 滚动到目标位置并高亮
        scrollToElement(target);
        highlightElement(target);
        updateActiveLink(catData.id, true); // 用户点击时展开分类
        
        // 滚动完成后恢复自动更新
        setTimeout(() => {
          isUserScrolling = false;
        }, 800);
      }
    });
  }
  
  catDiv.appendChild(toggle);
  catDiv.appendChild(itemsDiv);
  
  return catDiv;
}

/**
 * 更新主侧边栏内容
 * @param {Array} items - 侧边栏项数组，格式: [{name, icon?, id?, children?: [{name, id, articleTitle?, isCurrent?}]}]
 * @param {string} activeId - 要激活的链接 ID（可选）
 */
export function updateSidebar(items, activeId = null) {
  const sidebar = qs('.sidebar');
  if (!sidebar) {
    console.warn('[SidebarManager] 侧边栏不存在');
    return;
  }
  
  const categoriesContainer = sidebar.querySelector('.categories');
  if (!categoriesContainer) {
    console.warn('[SidebarManager] 分类容器不存在');
    return;
  }
  
  // 清空现有内容
  categoriesContainer.innerHTML = '';
  activeLinkId = null;
  
  if (!items || items.length === 0) {
    return;
  }
  
  // 创建新的分类项
  items.forEach((item, index) => {
    const catDiv = createCategory(item, index);
    categoriesContainer.appendChild(catDiv);
  });
  
  // 设置 Intersection Observer
  setupIntersectionObserver(items);
  
  // 如果有指定的激活 ID，使用它；否则默认选中第一个项目
  if (activeId) {
    setTimeout(() => {
      isUserScrolling = true;
      updateActiveLink(activeId, true);
      setTimeout(() => {
        isUserScrolling = false;
      }, 500);
    }, 300);
  } else {
    selectFirstItem(items);
  }
}

/**
 * 默认选中第一个子项
 */
function selectFirstItem(items) {
  if (!items || items.length === 0) return;
  
  // 找到第一个有子项的分类，选中其第一个子项
  let firstChildId = null;
  for (const item of items) {
    if (item.children && item.children.length > 0 && item.children[0].id) {
      firstChildId = item.children[0].id;
      break;
    }
  }
  
  if (firstChildId) {
    // 延迟执行，确保DOM和Observer都已准备好
    setTimeout(() => {
      // 暂时禁用自动更新，避免被 Observer 覆盖
      isUserScrolling = true;
      updateActiveLink(firstChildId, true); // 初始加载时展开分类
      // 恢复自动更新
      setTimeout(() => {
        isUserScrolling = false;
      }, 500);
    }, 300);
  }
}

/**
 * 清理侧边栏状态
 */
export function cleanupSidebar() {
  if (currentObserver) {
    currentObserver.disconnect();
    currentObserver = null;
  }
  activeLinkId = null;
}

