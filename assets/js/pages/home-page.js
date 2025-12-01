/**
 * 首页模块
 */

import { qs } from '../utils/utils.js';
import * as UI from '../ui.js';

/**
 * 初始化首页
 */
export function initHomePage(grid, pager) {
  console.log('[Home] 初始化首页', { grid, pager });
  
  if (!grid) {
    console.warn('[Home] grid 不存在');
    return;
  }
  
  // 设置翻页源为网格
  UI.setPaginationSource('.grid');
  
  // 调整网格布局
  UI.adjustGridLayout();
  
  // 移除加载状态
  if (pager) {
    pager.classList.remove('content-loading');
  }
}

/**
 * 重置首页状态（用于重新加载）
 */
export function resetHomePage() {
  // 首页不需要特殊的状态重置
  // 因为使用的是静态的 grid 元素
}

