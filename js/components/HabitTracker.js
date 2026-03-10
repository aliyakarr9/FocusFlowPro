/* ============================================
   FocusFlow Pro — HabitTracker Component (v4)
   Fixed: future days blocked, streak logic improved
   ============================================ */

import store from '../store.js';
import { toLocalDateStr } from '../utils/helpers.js';

const HABIT_ICONS = ['🎯', '💪', '📖', '🧘', '🏃', '💧', '🍎', '😴', '✍️', '🎵', '🏋️', '🧹'];

export function renderHabits(container) {
  const habits = store.habits;
  const today = toLocalDateStr(new Date());
  const weekDays = getWeekDays();

  container.innerHTML = `
    <div class="habit-header">
      <h3 style="font-size:1.1rem;font-weight:700;">Alışkanlık Takibi</h3>
      <button class="habit-add-btn" id="habit-add-btn">+ Yeni Alışkanlık</button>
    </div>

    ${habits.length === 0 ? `
      <div class="task-list-empty" style="padding:var(--space-xl);">
        <div class="empty-icon">🧘</div>
        <p>Henüz alışkanlık eklemedin. Günlük rutinlerini takip etmeye başla!</p>
      </div>
    ` : ''}

    <div class="habit-grid" id="habit-grid">
      ${habits.map(h => {
    const streak = getHabitStreak(h);
    const completedToday = !!h.history[today];
    return `
          <div class="habit-card ${completedToday ? 'habit-done-today' : ''}" data-id="${h.id}">
            <div class="habit-card-header">
              <span class="habit-icon">${h.icon}</span>
              <span class="habit-name">${escapeHtml(h.name)}</span>
              <span class="habit-streak-inline">🔥 ${streak}</span>
              <button class="habit-delete" data-id="${h.id}" title="Sil">✕</button>
            </div>
            <div class="habit-week">
              ${weekDays.map(d => {
      const done = h.history[d.date];
      const isToday = d.date === today;
      const isFuture = d.date > today;
      return `
                  <div class="habit-day ${done ? 'done' : ''} ${isToday ? 'today' : ''} ${isFuture ? 'future' : ''}" 
                       data-habit="${h.id}" data-date="${d.date}" title="${d.fullLabel}${isFuture ? ' (gelecek)' : ''}">
                    <span class="habit-day-label">${d.name}</span>
                    <span class="habit-day-check">${done ? '✓' : ''}</span>
                  </div>
                `;
    }).join('')}
            </div>
          </div>
        `;
  }).join('')}
    </div>
  `;

  // Add habit
  document.getElementById('habit-add-btn')?.addEventListener('click', () => showAddHabitModal());

  // Toggle day — only allow past and today, NOT future
  container.querySelectorAll('.habit-day').forEach(el => {
    el.addEventListener('click', () => {
      const dateStr = el.dataset.date;
      if (dateStr > today) return; // Block future dates
      store.toggleHabitDay(el.dataset.habit, dateStr);
    });
  });

  // Delete habit
  container.querySelectorAll('.habit-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('Bu alışkanlığı silmek istediğine emin misin?')) store.deleteHabit(btn.dataset.id);
    });
  });
}

function showAddHabitModal() {
  document.querySelector('.modal-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box">
      <div class="modal-header">
        <h3>🎯 Yeni Alışkanlık</h3>
        <button class="modal-close">✕</button>
      </div>
      <input type="text" class="modal-input" placeholder="Alışkanlık adı (örn: Kitap oku)" maxlength="40" />
      <div class="habit-icon-picker">
        ${HABIT_ICONS.map((icon, i) => `<button class="habit-icon-btn ${i === 0 ? 'selected' : ''}" data-icon="${icon}">${icon}</button>`).join('')}
      </div>
      <button class="modal-btn-save">Ekle</button>
    </div>
  `;
  document.body.appendChild(overlay);

  let selectedIcon = '🎯';
  const nameInput = overlay.querySelector('.modal-input');
  nameInput.focus();

  overlay.querySelectorAll('.habit-icon-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      overlay.querySelectorAll('.habit-icon-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedIcon = btn.dataset.icon;
    });
  });

  function add() {
    const name = nameInput.value.trim();
    if (name) { store.addHabit(name, selectedIcon); overlay.remove(); }
  }

  overlay.querySelector('.modal-btn-save').addEventListener('click', add);
  nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
  overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
}

function getWeekDays() {
  const dayNames = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
  const days = [];
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sunday
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push({
      date: toLocalDateStr(d),
      name: dayNames[d.getDay()],
      fullLabel: d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' }),
    });
  }
  return days;
}

/**
 * Streak calculation:
 * - Count consecutive completed days going backward
 * - If today is completed → start from today
 * - If today is NOT completed (day still going) → start from yesterday
 * - This way, marking Mon+Tue gives streak 2 even if today (Tue) is the current day
 */
function getHabitStreak(habit) {
  let streak = 0;
  const now = new Date();
  const today = toLocalDateStr(now);

  // If today is marked, start counting from today
  if (habit.history[today]) {
    let d = new Date(now);
    while (true) {
      const dateStr = toLocalDateStr(d);
      if (habit.history[dateStr]) { streak++; d.setDate(d.getDate() - 1); }
      else break;
    }
  } else {
    // Today not yet done — start counting from yesterday
    // (because today isn't over yet)
    let d = new Date(now);
    d.setDate(d.getDate() - 1);
    while (true) {
      const dateStr = toLocalDateStr(d);
      if (habit.history[dateStr]) { streak++; d.setDate(d.getDate() - 1); }
      else break;
    }
  }
  return streak;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
