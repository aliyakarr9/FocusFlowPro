/* ============================================
   FocusFlow Pro — Sidebar Component (v3)
   Added: XP progress bar & level display
   ============================================ */

import store from '../store.js';
import { getCurrentBadge, getLevelInfo, isOverdue } from '../utils/helpers.js';

export function renderSidebar() {
  const sidebar = document.getElementById('sidebar');
  const streak = store.streak;
  const levelInfo = getLevelInfo(store.xp);
  const overdueTasks = store.tasks.filter(t => !t.completed && isOverdue(t.dueDate));

  sidebar.innerHTML = `
    <div class="sidebar-header">
      <div class="sidebar-logo">
        <span class="logo-text"><span class="logo-focus">Focus</span><span class="logo-flow">Flow</span></span>
      </div>
    </div>

    <nav class="sidebar-nav">
      <div class="nav-section-title">Görevler</div>
      <div class="nav-item active" data-page="daily">
        <span class="nav-icon">📋</span>
        <span>Bugün</span>
        <span class="nav-badge" id="daily-count">${store.getTasksByList('daily').filter(t => !t.completed).length}</span>
      </div>
      <div class="nav-item" data-page="weekly">
        <span class="nav-icon">📅</span>
        <span>Haftalık</span>
        <span class="nav-badge" id="weekly-count">${store.getTasksByList('weekly').filter(t => !t.completed).length}</span>
      </div>
      ${overdueTasks.length > 0 ? `
        <div class="nav-overdue-alert">
          ⚠️ ${overdueTasks.length} gecikmiş görev
        </div>
      ` : ''}

      <div class="nav-section-title">Araçlar</div>
      <div class="nav-item" data-page="pomodoro">
        <span class="nav-icon">🍅</span>
        <span>Pomodoro</span>
      </div>
      <div class="nav-item" data-page="habits">
        <span class="nav-icon">🧘</span>
        <span>Alışkanlıklar</span>
      </div>
      <div class="nav-item" data-page="analytics">
        <span class="nav-icon">📊</span>
        <span>Analiz</span>
      </div>
      <div class="nav-item" data-page="badges">
        <span class="nav-icon">🏅</span>
        <span>Koleksiyon</span>
      </div>
      <div class="nav-item" data-page="schedule">
        <span class="nav-icon">🗓️</span>
        <span>Ders Programı</span>
      </div>
    </nav>

    <div class="sidebar-shortcuts">
      <div class="shortcut-hint">⌘N Yeni görev · ⌘Z Geri al</div>
      <div class="shortcut-hint">1-6 Sayfa geçişi</div>
    </div>

    <div class="sidebar-xp-panel">
      <div class="xp-level-header">
        <span class="xp-level-icon">${levelInfo.icon}</span>
        <div class="xp-level-info">
          <span class="xp-level-title">Svy. ${levelInfo.level} — ${levelInfo.title}</span>
          <span class="xp-total">${store.xp} XP</span>
        </div>
      </div>
      <div class="xp-bar-wrapper">
        <div class="xp-bar-fill" style="width:${levelInfo.progress}%"></div>
      </div>
      <div class="xp-bar-labels">
        <span>${levelInfo.xpInLevel}</span>
        <span>${levelInfo.next ? levelInfo.xpNeeded : 'MAX'}</span>
      </div>
      <div class="sidebar-streak-mini">
        <span class="streak-fire">🔥</span>
        <span>${streak} Günlük Seri</span>
      </div>
    </div>
  `;

  sidebar.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const page = item.dataset.page;
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      window.dispatchEvent(new CustomEvent('navigate', { detail: { page } }));
    });
  });
}

export function updateSidebarCounts() {
  const dailyEl = document.getElementById('daily-count');
  const weeklyEl = document.getElementById('weekly-count');
  if (dailyEl) dailyEl.textContent = store.getTasksByList('daily').filter(t => !t.completed).length;
  if (weeklyEl) weeklyEl.textContent = store.getTasksByList('weekly').filter(t => !t.completed).length;
}

export function updateSidebarXP() {
  const levelInfo = getLevelInfo(store.xp);
  const streak = store.streak;

  const titleEl = document.querySelector('.xp-level-title');
  const totalEl = document.querySelector('.xp-total');
  const fillEl = document.querySelector('.xp-bar-fill');
  const iconEl = document.querySelector('.xp-level-icon');
  const labelsEl = document.querySelectorAll('.xp-bar-labels span');
  const streakEl = document.querySelector('.sidebar-streak-mini');

  if (titleEl) titleEl.textContent = `Svy. ${levelInfo.level} — ${levelInfo.title}`;
  if (totalEl) totalEl.textContent = `${store.xp} XP`;
  if (fillEl) fillEl.style.width = `${levelInfo.progress}%`;
  if (iconEl) iconEl.textContent = levelInfo.icon;
  if (labelsEl[0]) labelsEl[0].textContent = levelInfo.xpInLevel;
  if (labelsEl[1]) labelsEl[1].textContent = levelInfo.next ? levelInfo.xpNeeded : 'MAX';
  if (streakEl) streakEl.innerHTML = `<span class="streak-fire">🔥</span><span>${streak} Günlük Seri</span>`;
}

// Keep backward compat alias
export const updateSidebarStreak = updateSidebarXP;

