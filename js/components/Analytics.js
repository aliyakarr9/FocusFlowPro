/* ============================================
   FocusFlow Pro — Analytics Component (v3)
   Uses dynamic categories from store
   ============================================ */

import store from '../store.js';
import { getCategoryStats, calculateProgress, getAllBadges, getLevelInfo, ALL_ACHIEVEMENTS, isOverdue } from '../utils/helpers.js';

export function renderAnalytics(container) {
  const allTasks = store.tasks;
  const dailyTasks = store.getTasksByList('daily');
  const totalDone = allTasks.filter(t => t.completed).length;
  const overdueTasks = allTasks.filter(t => !t.completed && isOverdue(t.dueDate));
  const categories = store.categories;
  const categoryStats = getCategoryStats(allTasks, categories);

  container.innerHTML = `
    <div class="analytics-grid">
      <div class="stat-card"><div class="stat-value">${allTasks.length}</div><div class="stat-label">Toplam Görev</div></div>
      <div class="stat-card"><div class="stat-value">${totalDone}</div><div class="stat-label">Tamamlanan</div></div>
      <div class="stat-card"><div class="stat-value" style="color:var(--success)">%${calculateProgress(dailyTasks)}</div><div class="stat-label">Günlük İlerleme</div></div>
      <div class="stat-card"><div class="stat-value" style="color:var(--warning)">${overdueTasks.length}</div><div class="stat-label">Gecikmiş</div></div>
      <div class="stat-card"><div class="stat-value">🔥 ${store.streak}</div><div class="stat-label">Günlük Seri</div></div>
      <div class="stat-card"><div class="stat-value">🍅 ${store.pomodoroSessions}</div><div class="stat-label">Pomodoro</div></div>
    </div>

    <h3 style="margin-bottom:var(--space-md);font-size:1.1rem;font-weight:700;">Kategori Analizi</h3>
    <div class="category-stats" id="cat-stats-container"></div>

    <div style="margin-top:var(--space-xl);text-align:center;display:flex;gap:var(--space-sm);justify-content:center;flex-wrap:wrap;">
      <button class="pomo-btn secondary" id="export-data-btn">📥 Verileri Dışa Aktar</button>
      <button class="pomo-btn secondary" id="import-data-btn">📤 Yedekten Geri Yükle</button>
    </div>
  `;

  const catContainer = container.querySelector('#cat-stats-container');
  categories.forEach(cat => {
    const stat = categoryStats[cat.id];
    if (!stat || stat.total === 0) return;
    const row = document.createElement('div');
    row.className = 'cat-stat-row';
    row.innerHTML = `
      <div class="cat-stat-header">
        <span class="cat-stat-name">${cat.icon} ${cat.label}</span>
        <span class="cat-stat-percent">%${stat.percent} · ${stat.done}/${stat.total}</span>
      </div>
      <div class="cat-stat-bar">
        <div class="cat-stat-fill" style="width:${stat.percent}%;background:${cat.color}"></div>
      </div>
    `;
    catContainer.appendChild(row);
  });

  document.getElementById('export-data-btn')?.addEventListener('click', () => store.exportData());

  document.getElementById('import-data-btn')?.addEventListener('click', () => {
    if (!confirm('⚠️ Mevcut tüm verileriniz yedek dosyasındaki verilerle DEĞİŞTİRİLECEK.\n\nDevam etmek istiyor musunuz?')) return;
    store.importData()
      .then(() => {
        alert('✅ Veriler başarıyla geri yüklendi!');
        // Re-render the page
        window.location.reload();
      })
      .catch(err => alert('❌ Hata: ' + err));
  });
}

export function renderBadges(container) {
  const badges = getAllBadges();
  const streak = store.streak;
  const badgeDates = store.badgeDates;
  const levelInfo = getLevelInfo(store.xp);
  const xpLog = store.xpLog || [];

  container.innerHTML = `
    <!-- XP Level Overview -->
    <div class="xp-overview-card">
      <div class="xp-overview-icon">${levelInfo.icon}</div>
      <div class="xp-overview-info">
        <div class="xp-overview-level">Seviye ${levelInfo.level} — ${levelInfo.title}</div>
        <div class="xp-overview-total">${store.xp} XP</div>
      </div>
      <div class="xp-overview-bar-wrapper">
        <div class="xp-bar-fill" style="width:${levelInfo.progress}%"></div>
      </div>
      <div class="xp-overview-bar-labels">
        <span>${levelInfo.xpInLevel} / ${levelInfo.next ? levelInfo.xpNeeded : 'MAX'}</span>
        <span>${levelInfo.next ? `Sonraki: ${levelInfo.next.icon} ${levelInfo.next.title}` : '🎉 Maksimum Seviye!'}</span>
      </div>
    </div>

    <!-- XP Activity Log -->
    ${xpLog.length > 0 ? `
    <div class="xp-log-section">
      <h3 class="xp-log-title">📜 Son XP Aktiviteleri</h3>
      <div class="xp-log-list">
        ${xpLog.slice(0, 10).map(entry => `
          <div class="xp-log-item ${entry.amount > 0 ? 'gain' : 'loss'}">
            <span class="xp-log-amount">${entry.amount > 0 ? '+' : ''}${entry.amount}</span>
            <span class="xp-log-reason">${entry.reason}</span>
            <span class="xp-log-date">${new Date(entry.date).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}

    <!-- Achievements -->
    <h3 style="margin:var(--space-lg) 0 var(--space-md);font-size:1rem;font-weight:700;">🏅 Başarım Rozetleri</h3>
    <div class="badge-grid" id="achievement-grid"></div>

    <!-- Streak & Badges -->
    <div style="text-align:center;margin:var(--space-xl) 0 var(--space-lg);">
      <div style="font-size:2.5rem;margin-bottom:var(--space-xs);">🔥</div>
      <div style="font-size:1.6rem;font-weight:800;color:var(--accent);">${streak}</div>
      <div style="color:var(--text-muted);font-size:0.85rem;">Günlük Seri</div>
    </div>
    <h3 style="margin-bottom:var(--space-md);font-size:1rem;font-weight:700;">🏅 Seri Rozetleri</h3>
    <div class="badge-grid" id="badge-grid"></div>
  `;

  // Achievement badges
  const achGrid = container.querySelector('#achievement-grid');
  const earned = store.achievements || {};
  ALL_ACHIEVEMENTS.forEach(a => {
    const unlocked = !!earned[a.id];
    const card = document.createElement('div');
    card.className = `badge-card ${unlocked ? 'earned' : 'locked'}`;
    card.innerHTML = `
      <div class="badge-icon">${a.icon}</div>
      <div class="badge-name">${a.name}</div>
      <div class="badge-desc">${a.desc}</div>
      ${unlocked ? `<div class="badge-xp-reward">+${a.xp} XP</div>` : ''}
      ${unlocked && earned[a.id] ? `<div style="font-size:0.65rem;color:var(--text-muted);margin-top:4px;">${earned[a.id]}</div>` : ''}
    `;
    achGrid.appendChild(card);
  });

  const grid = container.querySelector('#badge-grid');
  badges.forEach(b => {
    const earned = streak >= b.days;
    const card = document.createElement('div');
    card.className = `badge-card ${earned ? 'earned' : 'locked'}`;
    card.innerHTML = `
      <div class="badge-icon">${b.icon}</div>
      <div class="badge-name">${b.name}</div>
      <div class="badge-desc">${b.desc}</div>
      ${earned && badgeDates[b.days] ? `<div style="font-size:0.65rem;color:var(--text-muted);margin-top:4px;">${badgeDates[b.days]}</div>` : ''}
    `;
    grid.appendChild(card);
  });
}
