/* ============================================
   FocusFlow Pro — Weekly Report Modal
   ============================================ */

import store from '../store.js';
import { toLocalDateStr } from '../utils/helpers.js';

export function checkAndShowWeeklyReport() {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon
    if (dayOfWeek !== 1) return; // Only on Monday

    const todayStr = toLocalDateStr(today);
    if (store.lastWeeklyReportDate === todayStr) return; // Already shown

    const stats = store.state.lastWeeklyStats;
    if (!stats || !stats.weekStart) return; // No past week data

    store.setLastWeeklyReportDate(todayStr);
    showWeeklyReport(stats);
}

export function showWeeklyReport(stats = null) {
    const data = stats || store.weeklyStats;
    document.querySelector('.modal-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
    <div class="modal-box weekly-report-modal">
      <div class="modal-header">
        <h3>📊 Haftalık Performans Raporu</h3>
        <button class="modal-close">✕</button>
      </div>
      <div class="weekly-report-content">
        <div class="report-hero">
          <div class="report-hero-icon">📈</div>
          <div class="report-hero-text">Geçen Hafta Özeti</div>
        </div>
        <div class="report-stats-grid">
          <div class="report-stat">
            <div class="report-stat-value">${data.tasksCompleted || 0}</div>
            <div class="report-stat-label">Görev Tamamlandı</div>
          </div>
          <div class="report-stat">
            <div class="report-stat-value">${data.xpEarned || 0}</div>
            <div class="report-stat-label">XP Kazanıldı</div>
          </div>
          <div class="report-stat">
            <div class="report-stat-value">${data.pomodoroCount || 0}</div>
            <div class="report-stat-label">Pomodoro</div>
          </div>
          <div class="report-stat">
            <div class="report-stat-value">${data.challengesCompleted || 0}</div>
            <div class="report-stat-label">Challenge</div>
          </div>
        </div>
        <div class="report-streak">
          🔥 Günlük Seri: <strong>${store.streak}</strong>
        </div>
        <div class="report-motivation">
          ${getReportMessage(data)}
        </div>
      </div>
      <div class="modal-actions">
        <button class="modal-btn-save report-close-btn">Harika, devam! 🚀</button>
      </div>
    </div>
  `;
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.querySelector('.modal-close').addEventListener('click', close);
    overlay.querySelector('.report-close-btn').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
}

function getReportMessage(data) {
    const tasks = data.tasksCompleted || 0;
    if (tasks >= 20) return '🏆 İnanılmaz bir hafta geçirdin! Böyle devam!';
    if (tasks >= 10) return '💪 Harika performans! Hedeflerine yaklaşıyorsun.';
    if (tasks >= 5) return '👍 İyi bir başlangıç! Bu haftayı daha da iyi yapabilirsin.';
    return '🌱 Her yeni hafta yeni bir fırsat. Hadi başlayalım!';
}
