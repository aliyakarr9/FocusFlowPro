import store from '../store.js';
import { toLocalDateStr } from '../utils/helpers.js';
import { icon, ICON_NAMES } from '../utils/icons.js';

/* Seçicide sunulan simgeler (icons.js adları) */
const ICON_LABELS = {
  target: 'Hedef', dumbbell: 'Spor', run: 'Koşu', book: 'Okuma', brain: 'Zihin',
  leaf: 'Doğa', droplet: 'Su', utensils: 'Beslenme', bed: 'Uyku', heart: 'Sağlık',
  music: 'Müzik', code: 'Kod', coffee: 'Kahve', timer: 'Süre', star: 'Yıldız',
};
const PICKER_ICONS = Object.keys(ICON_LABELS).filter(name => ICON_NAMES.includes(name));

const DEFAULT_ICON = 'target';

/* Eski kayıtlarda simge emoji olarak saklanıyor; yalnızca gösterimde eşlenir. */
const LEGACY_EMOJI_ICONS = {
  '\u{1F3AF}': 'target',   // hedef
  '\u{1F4AA}': 'dumbbell', // kol kası
  '\u{1F3CB}': 'dumbbell', // halterci
  '\u{1F4D6}': 'book',     // açık kitap
  '\u{1F4DA}': 'book',     // kitaplar
  '\u{1F9D8}': 'leaf',     // lotus oturuşu
  '\u{1F3C3}': 'run',      // koşucu
  '\u{1F4A7}': 'droplet',  // damla
  '\u{1F34E}': 'utensils', // elma
  '\u{1F957}': 'utensils', // salata
  '\u{1F634}': 'bed',      // uyuyan yüz
  '\u{1F6CF}': 'bed',      // yatak
  '\u{270D}': 'edit',        // yazan el
  '\u{1F3B5}': 'music',    // nota
  '\u{1F3B6}': 'music',    // notalar
  '\u{1F9F9}': 'sparkle',  // süpürge
  '\u{2615}': 'coffee',      // sıcak içecek
  '\u{2764}': 'heart',       // kalp
  '\u{1F4BB}': 'code',     // dizüstü
  '\u{23F0}': 'timer',       // çalar saat
  '\u{2B50}': 'star',        // yıldız
  '\u{1F331}': 'leaf',     // fidan
  '\u{1F9E0}': 'brain',    // beyin
};

const SHORT_DAY_NAMES = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

/* Sayfa yeniden çizildiğinde kaybolmasın diye taslak ve odak burada tutulur */
const draft = { name: '', icon: DEFAULT_ICON };
let pendingFocus = null;
let outsideListenerBound = false;

export function renderHabits(container) {
  const habits = store.habits;
  const today = toLocalDateStr(new Date());
  const weekDays = getWeekDays();
  const elapsedDays = weekDays.filter(d => d.date <= today).length;

  container.innerHTML = `
    <div class="habits">
      <form class="habit-add" id="habit-add-form" autocomplete="off">
        <div class="habit-icon-choice">
          <button type="button" class="habit-icon-toggle" id="habit-icon-toggle"
                  aria-haspopup="true" aria-expanded="false"
                  title="Simge seç" aria-label="Simge seç">
            ${icon(draft.icon, 18)}
            ${icon('chevron-down', 14)}
          </button>
          <div class="habit-icon-picker" id="habit-icon-picker" role="group" aria-label="Simgeler" hidden>
            ${PICKER_ICONS.map(name => `
              <button type="button" class="habit-icon-option ${name === draft.icon ? 'selected' : ''}"
                      data-icon="${name}" aria-pressed="${name === draft.icon}"
                      title="${ICON_LABELS[name]}" aria-label="${ICON_LABELS[name]}">${icon(name, 18)}</button>
            `).join('')}
          </div>
        </div>
        <input type="text" class="input habit-add-input" id="habit-add-input"
               placeholder="Yeni alışkanlık, örn. Kitap oku" maxlength="40"
               aria-label="Alışkanlık adı" value="${escapeHtml(draft.name)}" />
        <button type="submit" class="btn btn-primary">${icon('plus', 16)}Ekle</button>
      </form>

      ${habits.length === 0 ? `
        <div class="empty-state">
          ${icon('repeat', 32)}
          <p>Henüz alışkanlık yok. Her gün yapmak istediğin bir şeyi yukarıdan ekle.</p>
        </div>
      ` : `
        <div class="habit-list">
          <div class="habit-list-head" aria-hidden="true">
            <span class="habit-list-head-title">Bu hafta</span>
            <div class="habit-days">
              ${weekDays.map(d => `
                <span class="habit-day-head ${d.date === today ? 'today' : ''}">
                  <span>${d.short}</span>
                  <span class="habit-day-num">${d.dayNum}</span>
                </span>
              `).join('')}
            </div>
            <span class="habit-row-spacer"></span>
          </div>

          ${habits.map(h => renderHabitRow(h, weekDays, today, elapsedDays)).join('')}
        </div>
      `}
    </div>
  `;

  bindEvents(container, today);
  restoreFocus(container);
}

function renderHabitRow(h, weekDays, today, elapsedDays) {
  const history = h.history || {};
  const streak = getHabitStreak(h);
  const weekDone = weekDays.filter(d => d.date <= today && history[d.date]).length;
  const name = escapeHtml(h.name);

  return `
    <div class="habit-row" data-id="${h.id}">
      <span class="habit-row-icon">${icon(resolveHabitIcon(h.icon), 18)}</span>
      <div class="habit-row-main">
        <span class="habit-row-name">${name}</span>
        <span class="habit-row-meta">
          <span class="habit-streak ${streak > 0 ? 'active' : ''}" title="Seri: ${streak} gün">
            ${icon('flame', 14)}${streak} gün
          </span>
          <span class="habit-week-count" title="Bu hafta ${weekDone} / ${elapsedDays} gün">${weekDone}/7</span>
        </span>
      </div>
      <div class="habit-days" role="group" aria-label="${name}: bu hafta">
        ${weekDays.map(d => {
          const done = !!history[d.date];
          const isToday = d.date === today;
          const isFuture = d.date > today;
          const state = isFuture ? 'gelecek gün' : (done ? 'yapıldı' : 'yapılmadı');
          return `
            <span class="habit-cell-slot">
              <button type="button"
                      class="habit-cell ${done ? 'done' : ''} ${isToday ? 'today' : ''} ${isFuture ? 'future' : ''}"
                      data-habit="${h.id}" data-date="${d.date}"
                      title="${d.fullLabel}${isFuture ? ' (gelecek)' : ''}"
                      aria-label="${d.fullLabel}: ${state}"
                      aria-pressed="${done}" ${isFuture ? 'disabled' : ''}>
                ${done ? icon('check', 16) : ''}
              </button>
            </span>
          `;
        }).join('')}
      </div>
      <button type="button" class="icon-btn danger habit-delete" data-id="${h.id}"
              title="Alışkanlığı sil" aria-label="${name} alışkanlığını sil">${icon('trash', 16)}</button>
    </div>
  `;
}

function bindEvents(container, today) {
  const form = container.querySelector('#habit-add-form');
  const input = container.querySelector('#habit-add-input');
  const toggle = container.querySelector('#habit-icon-toggle');
  const picker = container.querySelector('#habit-icon-picker');

  const setPickerOpen = (open) => {
    picker.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
  };

  input.addEventListener('input', () => { draft.name = input.value; });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = input.value.trim();
    if (!name) { input.focus(); return; }
    const chosen = draft.icon;
    draft.name = '';
    draft.icon = DEFAULT_ICON;
    pendingFocus = '#habit-add-input';
    store.addHabit(name, chosen);
  });

  toggle.addEventListener('click', () => {
    const open = picker.hidden;
    setPickerOpen(open);
    if (open) picker.querySelector('.habit-icon-option.selected')?.focus();
  });

  picker.querySelectorAll('.habit-icon-option').forEach(btn => {
    btn.addEventListener('click', () => {
      draft.icon = btn.dataset.icon;
      picker.querySelectorAll('.habit-icon-option').forEach(b => {
        const sel = b === btn;
        b.classList.toggle('selected', sel);
        b.setAttribute('aria-pressed', String(sel));
      });
      toggle.innerHTML = `${icon(draft.icon, 18)}${icon('chevron-down', 14)}`;
      setPickerOpen(false);
      input.focus();
    });
  });

  form.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !picker.hidden) {
      setPickerOpen(false);
      toggle.focus();
    }
  });

  // Seçici dışına tıklanınca kapat (sayfa her çizildiğinde tekrar bağlanmasın)
  if (!outsideListenerBound) {
    outsideListenerBound = true;
    document.addEventListener('click', (e) => {
      const p = document.getElementById('habit-icon-picker');
      if (!p || p.hidden) return;
      if (e.target.closest('.habit-icon-choice')) return;
      p.hidden = true;
      document.getElementById('habit-icon-toggle')?.setAttribute('aria-expanded', 'false');
    });
  }

  // Gün işaretle — yalnızca geçmiş ve bugün
  container.querySelectorAll('.habit-cell').forEach(el => {
    el.addEventListener('click', () => {
      const dateStr = el.dataset.date;
      if (dateStr > today) return;
      pendingFocus = `.habit-cell[data-habit="${el.dataset.habit}"][data-date="${dateStr}"]`;
      store.toggleHabitDay(el.dataset.habit, dateStr);
    });
  });

  container.querySelectorAll('.habit-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const habit = store.habits.find(h => h.id === btn.dataset.id);
      const label = habit ? `"${habit.name}"` : 'Bu alışkanlık';
      if (confirm(`${label} silinsin mi? Geçmiş kayıtları da silinir.`)) {
        store.deleteHabit(btn.dataset.id);
      }
    });
  });
}

function restoreFocus(container) {
  if (!pendingFocus) return;
  const el = container.querySelector(pendingFocus);
  pendingFocus = null;
  el?.focus();
}

function resolveHabitIcon(value) {
  if (typeof value !== 'string' || !value) return DEFAULT_ICON;
  if (ICON_NAMES.includes(value)) return value;
  const key = value.replace(/[\u{FE0F}\u{200D}]/gu, '').trim();
  return LEGACY_EMOJI_ICONS[key] || LEGACY_EMOJI_ICONS[Array.from(key)[0]] || DEFAULT_ICON;
}

function getWeekDays() {
  const days = [];
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = pazar
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push({
      date: toLocalDateStr(d),
      short: SHORT_DAY_NAMES[d.getDay()],
      dayNum: d.getDate(),
      fullLabel: d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' }),
    });
  }
  return days;
}

/**
 * Seri: geriye doğru ardışık tamamlanan günler.
 * Bugün işaretliyse bugünden, değilse (gün bitmedi) dünden başlar.
 */
function getHabitStreak(habit) {
  const history = habit.history || {};
  let streak = 0;
  const d = new Date();
  if (!history[toLocalDateStr(d)]) d.setDate(d.getDate() - 1);
  while (history[toLocalDateStr(d)]) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
