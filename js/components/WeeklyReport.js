import store from '../store.js';
import { icon } from '../utils/icons.js';
import { toLocalDateStr } from '../utils/helpers.js';

export function checkAndShowWeeklyReport() {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = pazar, 1 = pazartesi
    if (dayOfWeek !== 1) return; // Yalnızca pazartesi

    const todayStr = toLocalDateStr(today);
    if (store.lastWeeklyReportDate === todayStr) return; // Bu hafta zaten gösterildi

    const stats = store.state.lastWeeklyStats;
    if (!stats || !stats.weekStart) return; // Geçen haftaya ait veri yok

    store.setLastWeeklyReportDate(todayStr);
    showWeeklyReport(stats);
}

function weekRangeLabel(weekStart) {
    if (!weekStart) return '';
    const start = new Date(`${weekStart}T00:00:00`);
    if (Number.isNaN(start.getTime())) return '';
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const fmt = d => d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
    return `${fmt(start)} – ${fmt(end)}`;
}

let activeKeyHandler = null;

export function showWeeklyReport(stats = null) {
    const isPast = !!stats;
    const data = stats || store.weeklyStats || {};
    document.querySelector('.modal-overlay')?.remove();
    if (activeKeyHandler) {
        document.removeEventListener('keydown', activeKeyHandler);
        activeKeyHandler = null;
    }

    const range = weekRangeLabel(data.weekStart);
    const items = [
        { icon: 'check', value: data.tasksCompleted || 0, label: 'Tamamlanan görev' },
        { icon: 'bolt', value: data.xpEarned || 0, label: 'Kazanılan XP' },
        { icon: 'timer', value: data.pomodoroCount || 0, label: 'Pomodoro oturumu' },
        { icon: 'target', value: data.challengesCompleted || 0, label: 'Günlük hedef' },
    ];

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
    <div class="modal-box wr-modal" role="dialog" aria-modal="true" aria-labelledby="wr-title">
      <div class="modal-header">
        <h3 id="wr-title">Haftalık rapor</h3>
        <button class="modal-close" title="Kapat" aria-label="Kapat">${icon('x', 16)}</button>
      </div>
      <div class="wr-period">
        <span class="wr-period-name">${isPast ? 'Geçen hafta' : 'Bu hafta, şimdiye kadar'}</span>
        ${range ? `<span class="section-hint">${range}</span>` : ''}
      </div>
      <div class="wr-grid">
        ${items.map(it => `
          <div class="wr-stat">
            <span class="wr-stat-icon">${icon(it.icon, 16)}</span>
            <span class="stat-value">${it.value}</span>
            <span class="stat-label">${it.label}</span>
          </div>
        `).join('')}
      </div>
      <div class="wr-streak">${icon('flame', 16)}<span>Günlük seri: <strong>${store.streak || 0} gün</strong></span></div>
      <p class="wr-message">${getReportMessage(data)}</p>
      <div class="modal-actions">
        <button class="modal-btn-save wr-close-btn">Tamam</button>
      </div>
    </div>
  `;
    document.body.appendChild(overlay);

    const close = () => {
        overlay.remove();
        document.removeEventListener('keydown', onKey);
        if (activeKeyHandler === onKey) activeKeyHandler = null;
    };
    const onKey = e => { if (e.key === 'Escape') close(); };
    activeKeyHandler = onKey;
    document.addEventListener('keydown', onKey);

    overlay.querySelector('.modal-close').addEventListener('click', close);
    overlay.querySelector('.wr-close-btn').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    overlay.querySelector('.wr-close-btn').focus();
}

function getReportMessage(data) {
    const tasks = data.tasksCompleted || 0;
    if (tasks >= 20) return 'Çok verimli bir hafta. Bu tempoyu korumaya çalış.';
    if (tasks >= 10) return 'İyi bir hafta geçirdin. Hedeflerine yaklaşıyorsun.';
    if (tasks >= 5) return 'Sağlam bir başlangıç. Bu hafta biraz daha ileri gidebilirsin.';
    return 'Her hafta yeni bir başlangıç. Küçük bir görevle başlayabilirsin.';
}
