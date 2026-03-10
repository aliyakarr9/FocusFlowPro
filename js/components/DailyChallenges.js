/* ============================================
   FocusFlow Pro — Daily Challenges Component
   ============================================ */

import store from '../store.js';

export function renderDailyChallenges(container) {
  const ch = store.dailyChallenges;
  if (!ch || !ch.items || ch.items.length === 0) return;

  const completedCount = ch.items.filter(i => i.done).length;
  const allDone = completedCount === ch.items.length;

  const wrapper = document.createElement('div');
  wrapper.className = 'daily-challenges-mini';
  wrapper.innerHTML = `
    <div class="challenges-mini-header">
      <span>🎯 Günlük Hedefler</span>
      <span class="challenges-mini-dots">
        ${ch.items.map(item => `<span class="challenge-dot ${item.done ? 'done' : ''}" title="${item.title} (${item.done ? '✓' : item.current + '/' + item.target})"></span>`).join('')}
      </span>
      <span class="challenges-mini-count">${completedCount}/${ch.items.length}</span>
    </div>
    ${!allDone ? `<div class="challenges-mini-list">
      ${ch.items.filter(i => !i.done).map(item => `
        <span class="challenge-mini-tag">${item.icon} ${item.title} <em>+${item.xp}</em></span>
      `).join('')}
    </div>` : '<div class="challenges-mini-done">🎉 Tüm hedefler tamamlandı!</div>'}
  `;

  // Insert at the very top, before task form
  container.prepend(wrapper);
}

export function updateChallengesUI() {
  const existing = document.querySelector('.daily-challenges-mini');
  if (!existing) return;
  const container = existing.parentElement;
  existing.remove();
  renderDailyChallenges(container);
}
