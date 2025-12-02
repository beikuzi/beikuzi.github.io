/**
 * 技能树页面模块
 */

import { qs } from '../utils/utils.js';
import * as UI from '../ui.js';

let __skillTreeContainer = null;

/**
 * 确保技能树容器存在
 */
function ensureSkillTreeContainer(blankView) {
  if (!blankView) return null;
  
  let container = blankView.querySelector('.skill-tree-container');
  if (!container) {
    container = document.createElement('section');
    container.className = 'skill-tree-container';
    blankView.appendChild(container);
  }
  return container;
}

/**
 * 初始化技能树页面
 */
export async function initSkillTreePage(blankView, pager) {
  console.log('[SkillTree] 初始化技能树页面', { blankView, pager });
  
  if (!blankView) {
    console.error('[SkillTree] blankView 不存在');
    return;
  }

  // 确保容器存在
  const container = ensureSkillTreeContainer(blankView);
  if (!container) {
    console.error('[SkillTree] 无法创建技能树容器');
    return;
  }

  __skillTreeContainer = container;

  // 清空容器
  container.innerHTML = '';

  // 移除加载状态
  if (pager) {
    pager.classList.remove('content-loading');
    pager.classList.add('pager-hidden');
  }

  // 渲染待完成页面
  container.innerHTML = `
    <div class="coming-soon-page">
      <div class="coming-soon-icon">🌳</div>
      <h1 class="coming-soon-title">技能树</h1>
      <div class="coming-soon-content">
        <p class="coming-soon-quote">「此乃通往力量巅峰的秘径，然而...」</p>
        <p class="coming-soon-text">技能树正在成长中，请稍候片刻~</p>
        <p class="coming-soon-subtitle">当这棵技能之树完全展开时，你将见证一个全新的世界！</p>
        <div class="coming-soon-progress">
          <div class="progress-bar">
            <div class="progress-fill" style="width: 0%"></div>
          </div>
          <p class="progress-text">技能树成长进度：0%</p>
        </div>
      </div>
    </div>
  `;

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
        progressText.textContent = `技能树成长进度：${Math.floor(progress)}%`;
      }, 100);
    }
  }, 500);
}

/**
 * 重置技能树页面状态
 */
export function resetSkillTreePage() {
  if (__skillTreeContainer) {
    __skillTreeContainer.innerHTML = '';
  }
}

