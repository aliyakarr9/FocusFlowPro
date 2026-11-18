import store from '../store.js';
import { icon } from '../utils/icons.js';

export function renderDailyChallenges(container) {
  const ch = store.dailyChallenges;
  if (!ch || !ch.items || ch.items.length === 0) return;

  const completedCount = ch.items.filter(i => i.done).length;
  const allDone = completedCount === ch.items.length;

  const wrapper = document.createElement('div');
  wrapper.className = 'daily-challenges-mini';
  wrapper.innerHTML = `
    <div class="challenges-mini-header">
      ${icon('target', 15)}<span>Günlük hedefler</span>
      <span class="challenges-mini-dots">
        ${ch.items.map(item => `<span class="challenge-dot ${item.done ? 'done' : ''}" title="${item.title} (${item.done ? 'tamam' : item.current + '/' + item.target})"></span>`).join('')}
      </span>
      <span class="challenges-mini-count">${completedCount}/${ch.items.length}</span>
    </div>
    ${!allDone ? `<div class="challenges-mini-list">
      ${ch.items.filter(i => !i.done).map(item => `
        <span class="challenge-mini-tag">${item.title}<em>+${item.xp} XP</em></span>
      `).join('')}
    </div>` : '<div class="challenges-mini-done">Bugünkü hedeflerin hepsi tamam.</div>'}
  `;

  // Sayfanın en üstüne, görev ekleme satırının üstüne
  container.prepend(wrapper);
}
