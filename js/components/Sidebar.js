import store from '../store.js';
import { getLevelInfo, isOverdue } from '../utils/helpers.js';
import { icon } from '../utils/icons.js';

const countText = (n) => (n > 0 ? String(n) : '');
const overdueAlert = (n) => (n > 0
  ? `<div class="nav-overdue-alert" role="button" tabindex="0" title="Bugün sayfasına git">${icon('alert', 16)}<span>${n} gecikmiş görev</span></div>`
  : '');
const countOverdue = () => store.tasks.filter(t => !t.completed && isOverdue(t.dueDate)).length;
const goToDaily = () => window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'daily' } }));
const xpTitle = (info) => (info.next ? `Sonraki seviyeye ${info.xpNeeded - info.xpInLevel} XP` : 'En yüksek seviye');

export function renderSidebar() {
  const sidebar = document.getElementById('sidebar');
  const streak = store.streak;
  const levelInfo = getLevelInfo(store.xp);
  const overdueTasks = store.tasks.filter(t => !t.completed && isOverdue(t.dueDate));

  sidebar.innerHTML = `
    <div class="sidebar-header">
      <div class="sidebar-logo">
        <span class="logo-text">FocusFlow</span>
      </div>
    </div>

    <nav class="sidebar-nav">
      <div class="nav-section-title">Görevler</div>
      <div class="nav-item active" data-page="daily">
        <span class="nav-icon">${icon('sun')}</span>
        <span>Bugün</span>
        <span class="nav-badge" id="daily-count">${countText(store.getTasksByList('daily').filter(t => !t.completed).length)}</span>
      </div>
      <div class="nav-item" data-page="weekly">
        <span class="nav-icon">${icon('calendar')}</span>
        <span>Haftalık</span>
        <span class="nav-badge" id="weekly-count">${countText(store.getTasksByList('weekly').filter(t => !t.completed).length)}</span>
      </div>
      <div id="overdue-slot">${overdueAlert(overdueTasks.length)}</div>

      <div class="nav-section-title">Araçlar</div>
      <div class="nav-item" data-page="pomodoro">
        <span class="nav-icon">${icon('clock')}</span>
        <span>Pomodoro</span>
      </div>
      <div class="nav-item" data-page="habits">
        <span class="nav-icon">${icon('repeat')}</span>
        <span>Alışkanlıklar</span>
      </div>
      <div class="nav-item" data-page="analytics">
        <span class="nav-icon">${icon('chart')}</span>
        <span>Analiz</span>
      </div>
      <div class="nav-item" data-page="badges">
        <span class="nav-icon">${icon('award')}</span>
        <span>Koleksiyon</span>
      </div>
      <div class="nav-item" data-page="schedule">
        <span class="nav-icon">${icon('table')}</span>
        <span>Ders Programı</span>
      </div>
    </nav>

    <div class="sidebar-shortcuts">
      <div class="shortcut-hint">N yeni görev · / ara · ? kısayollar</div>
    </div>

    <div class="sidebar-xp-panel">
      <div class="xp-level-header">
        <span class="xp-level-title">Seviye ${levelInfo.level} · ${levelInfo.title}</span>
        <span class="xp-total">${store.xp} XP</span>
      </div>
      <div class="xp-bar-wrapper" title="${xpTitle(levelInfo)}">
        <div class="xp-bar-fill" style="width:${levelInfo.progress}%"></div>
      </div>
      <div class="sidebar-streak-mini">
        <span class="streak-fire">${icon('flame', 15)}</span>
        <span>${streak} günlük seri</span>
      </div>
    </div>
  `;

  // Gecikmiş görev uyarısı (içeriği updateSidebarCounts ile güncellenir)
  const overdueSlot = sidebar.querySelector('#overdue-slot');
  overdueSlot.addEventListener('click', (e) => { if (e.target.closest('.nav-overdue-alert')) goToDaily(); });
  overdueSlot.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('.nav-overdue-alert')) { e.preventDefault(); goToDaily(); }
  });

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
  if (dailyEl) dailyEl.textContent = countText(store.getTasksByList('daily').filter(t => !t.completed).length);
  if (weeklyEl) weeklyEl.textContent = countText(store.getTasksByList('weekly').filter(t => !t.completed).length);
  const overdueSlot = document.getElementById('overdue-slot');
  if (overdueSlot) overdueSlot.innerHTML = overdueAlert(countOverdue());
}

export function updateSidebarXP() {
  const levelInfo = getLevelInfo(store.xp);
  const streak = store.streak;

  const titleEl = document.querySelector('.xp-level-title');
  const totalEl = document.querySelector('.xp-total');
  const fillEl = document.querySelector('.xp-bar-fill');
  const barEl = document.querySelector('.xp-bar-wrapper');
  const streakEl = document.querySelector('.sidebar-streak-mini');

  if (titleEl) titleEl.textContent = `Seviye ${levelInfo.level} · ${levelInfo.title}`;
  if (totalEl) totalEl.textContent = `${store.xp} XP`;
  if (fillEl) fillEl.style.width = `${levelInfo.progress}%`;
  if (barEl) barEl.title = xpTitle(levelInfo);
  if (streakEl) streakEl.innerHTML = `<span class="streak-fire">${icon('flame', 15)}</span><span>${streak} günlük seri</span>`;
}
