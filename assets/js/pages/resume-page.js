/**
 * 简历页面模块
 */

import { qs } from '../utils/utils.js';
import * as UI from '../ui.js';
import * as SidebarManager from '../utils/sidebar-manager.js';

let __resumeContainer = null;

/**
 * 确保简历容器存在
 */
function ensureResumeContainer(blankView) {
  if (!blankView) return null;
  
  let container = blankView.querySelector('.resume-container');
  if (!container) {
    container = document.createElement('section');
    container.className = 'resume-container';
    blankView.appendChild(container);
  }
  return container;
}

/**
 * 初始化简历页面
 */
export async function initResumePage(blankView, pager) {
  console.log('[Resume] 初始化简历页面', { blankView, pager });
  
  if (!blankView) {
    console.error('[Resume] blankView 不存在');
    return;
  }

  // 确保容器存在
  const container = ensureResumeContainer(blankView);
  if (!container) {
    console.error('[Resume] 无法创建简历容器');
    return;
  }

  __resumeContainer = container;

  // 清空容器
  container.innerHTML = '';

  // 移除加载状态
  if (pager) {
    pager.classList.remove('content-loading');
    pager.classList.add('pager-hidden');
  }

  // 渲染待完成页面
  container.innerHTML = `
    <div class="coming-soon-page" id="resume-content">
      <div class="coming-soon-icon">📜</div>
      <h1 class="coming-soon-title">个人简历</h1>
      <div class="coming-soon-content">
        <p class="coming-soon-quote">「记录着勇者征途的卷轴，此刻仍在书写中...」</p>
        <p class="coming-soon-text">简历正在精心雕琢中，敬请期待~</p>
        <p class="coming-soon-subtitle">当这份传奇完全展开时，你将看到一段精彩的冒险故事！</p>
        <div class="coming-soon-progress">
          <div class="progress-bar">
            <div class="progress-fill" style="width: 0%"></div>
          </div>
          <p class="progress-text">简历完成度：0%</p>
        </div>
      </div>
    </div>
  `;
  
  // 更新主侧边栏
  SidebarManager.updateSidebar([{
    id: 'resume-content',
    name: '个人简历',
    icon: '📜'
  }]);

  // 添加进度条动画
  setTimeout(() => {
    const progressFill = container.querySelector('.progress-fill');
    const progressText = container.querySelector('.progress-text');
    if (progressFill && progressText) {
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 2;
        if (progress > 100) {
          progress = 100;
          clearInterval(interval);
        }
        progressFill.style.width = `${progress}%`;
        progressText.textContent = `简历完成度：${Math.floor(progress)}%`;
      }, 100);
    }
  }, 500);
}

/**
 * 重置简历页面状态
 */
export function resetResumePage() {
  if (__resumeContainer) {
    __resumeContainer.innerHTML = '';
  }
  SidebarManager.cleanupSidebar();
}

