import store from '../store.js';
import { formatTime } from '../utils/helpers.js';
import { icon } from '../utils/icons.js';

const RING_RADIUS = 120;
const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const LIMITS = { focus: [5, 120], breakTime: [1, 60], rounds: [1, 20] };
const STEPS = { focus: 5, breakTime: 5, rounds: 1 };
const PRESETS = { focus: [25, 30, 45, 50], breakTime: [5, 10, 15, 20], rounds: [2, 3, 4, 5] };

let timerInterval = null;
let config = { focus: 50, breakTime: 15, rounds: 5 };
let currentRound = 0;
let isBreak = false;
let isRunning = false;
let isConfigured = false;
let totalSeconds = 0;
let remainingSeconds = 0;
let lastCompletedRounds = 0;

let currentContainer = null;
let keyListenerBound = false;
const baseTitle = document.title;

export function renderPomodoro(container) {
  currentContainer = container;
  bindKeyboard();
  if (!isConfigured) {
    renderConfigScreen(container);
  } else {
    renderTimerScreen(container);
  }
  syncTitle();
}

/* Planlama */

function totals() {
  const focus = config.focus * config.rounds;
  const rest = config.breakTime * Math.max(0, config.rounds - 1);
  return { focus, rest, all: focus + rest };
}

function formatMinutes(min) {
  if (min < 60) return `${min} dk`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} sa ${m} dk` : `${h} sa`;
}

function plannerCard(field, label, value, unit, iconName) {
  const valueId = `cfg-${field}`;
  return `
    <div class="card pomo-config-card">
      <div class="pomo-config-label">
        <span class="pomo-config-icon">${icon(iconName, 16)}</span>
        <span id="${valueId}-label">${label}</span>
      </div>
      <div class="pomo-stepper" role="group" aria-labelledby="${valueId}-label">
        <button type="button" class="icon-btn pomo-stepper-btn" data-field="${field}" data-dir="-1"
          title="${label} azalt" aria-label="${label} azalt">${icon('minus', 16)}</button>
        <span class="pomo-stepper-value" aria-live="polite">
          <span class="pomo-stepper-number" id="${valueId}">${value}</span>
          <span class="pomo-stepper-unit">${unit}</span>
        </span>
        <button type="button" class="icon-btn pomo-stepper-btn" data-field="${field}" data-dir="1"
          title="${label} artır" aria-label="${label} artır">${icon('plus', 16)}</button>
      </div>
      <div class="segmented pomo-presets" role="group" aria-label="${label} hazır değerleri">
        ${PRESETS[field].map(v => `
          <button type="button" class="pomo-preset-btn ${config[field] === v ? 'active' : ''}"
            data-field="${field}" data-val="${v}" aria-pressed="${config[field] === v}">${v}</button>
        `).join('')}
      </div>
    </div>
  `;
}

function renderConfigScreen(container) {
  const t = totals();
  const sessions = store.pomodoroSessions;

  container.innerHTML = `
    <div class="pomo-container">
      <div class="pomo-intro">
        <h2 class="section-title">Oturum planla</h2>
        <p class="section-hint">Odak süresini, mola süresini ve tur sayısını seç.</p>
      </div>

      ${lastCompletedRounds ? `
        <div class="pomo-done-note">
          <span class="pill pill-success">${icon('check', 14)} Son oturum tamamlandı: ${lastCompletedRounds} tur</span>
        </div>
      ` : ''}

      <div class="pomo-config-grid">
        ${plannerCard('focus', 'Odak', config.focus, 'dk', 'target')}
        ${plannerCard('breakTime', 'Mola', config.breakTime, 'dk', 'coffee')}
        ${plannerCard('rounds', 'Tur', config.rounds, 'tur', 'repeat')}
      </div>

      <div class="card pomo-summary">
        <div class="stat">
          <span class="stat-value" id="total-focus">${formatMinutes(t.focus)}</span>
          <span class="stat-label">Toplam odak</span>
        </div>
        <div class="stat">
          <span class="stat-value" id="total-break">${formatMinutes(t.rest)}</span>
          <span class="stat-label">Toplam mola</span>
        </div>
        <div class="stat">
          <span class="stat-value" id="total-time">${formatMinutes(t.all)}</span>
          <span class="stat-label">Toplam süre</span>
        </div>
      </div>

      <button type="button" class="btn btn-primary pomo-start-session" id="pomo-start-session">
        ${icon('play', 16)} Oturumu başlat
      </button>
      <p class="pomo-shortcut-hint">Boşluk tuşu ile de başlatabilirsin.</p>

      <div class="pomo-total-stats">
        <div class="stat">
          <span class="stat-value">${sessions}</span>
          <span class="stat-label">Tamamlanan odak turu</span>
        </div>
        <div class="stat">
          <span class="stat-value">${Math.round(sessions * 25 / 60)} sa</span>
          <span class="stat-label">Tahmini odak süresi</span>
        </div>
      </div>
    </div>
  `;

  function setField(field, value) {
    config[field] = Math.max(LIMITS[field][0], Math.min(LIMITS[field][1], value));
    container.querySelector(`#cfg-${field}`).textContent = config[field];
    container.querySelectorAll(`.pomo-preset-btn[data-field="${field}"]`).forEach(p => {
      const on = parseInt(p.dataset.val, 10) === config[field];
      p.classList.toggle('active', on);
      p.setAttribute('aria-pressed', String(on));
    });
    container.querySelectorAll(`.pomo-stepper-btn[data-field="${field}"]`).forEach(b => {
      const dir = parseInt(b.dataset.dir, 10);
      b.disabled = dir < 0 ? config[field] <= LIMITS[field][0] : config[field] >= LIMITS[field][1];
    });
    const s = totals();
    container.querySelector('#total-focus').textContent = formatMinutes(s.focus);
    container.querySelector('#total-break').textContent = formatMinutes(s.rest);
    container.querySelector('#total-time').textContent = formatMinutes(s.all);
  }

  container.querySelectorAll('.pomo-stepper-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const field = btn.dataset.field;
      const dir = parseInt(btn.dataset.dir, 10);
      setField(field, config[field] + dir * STEPS[field]);
    });
  });

  container.querySelectorAll('.pomo-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setField(btn.dataset.field, parseInt(btn.dataset.val, 10));
    });
  });

  // İlk durumda sınırdaki düğmeleri pasif yap
  Object.keys(LIMITS).forEach(f => setField(f, config[f]));

  container.querySelector('#pomo-start-session').addEventListener('click', () => startSession(container));

  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function startSession(container) {
  isConfigured = true;
  currentRound = 0;
  isBreak = false;
  lastCompletedRounds = 0;
  startNewPhase();
  renderTimerScreen(container);
  startTimer(container);
}

/* Sayaç */

function phaseText() {
  return isBreak ? 'Mola' : 'Odak';
}

function roundText() {
  return isBreak
    ? `${currentRound}. turdan sonra`
    : `Tur ${currentRound + 1} / ${config.rounds}`;
}

function nextText() {
  if (isBreak) return `Sıradaki: ${config.focus} dk odak, tur ${currentRound + 1} / ${config.rounds}`;
  if (currentRound + 1 >= config.rounds) return 'Sıradaki: oturum biter';
  return `Sıradaki: ${config.breakTime} dk mola`;
}

function renderTimerScreen(container) {
  const progress = totalSeconds ? (totalSeconds - remainingSeconds) / totalSeconds : 0;
  const phase = isBreak ? 'break' : 'focus';

  container.innerHTML = `
    <div class="pomo-container pomo-timer" data-phase="${phase}">
      <div class="pomo-phase">
        <span class="pill ${isBreak ? 'pill-success' : 'pill-accent'} pomo-phase-pill">
          ${icon(isBreak ? 'coffee' : 'target', 14)} ${phaseText()}
        </span>
        <span class="pomo-round-text">${roundText()}</span>
      </div>

      <ol class="pomo-round-tracker" aria-label="Tur ilerlemesi">
        ${Array.from({ length: config.rounds }, (_, i) => {
          let cls = 'round-dot';
          let state = 'bekliyor';
          if (i < currentRound) { cls += ' completed'; state = 'tamamlandı'; }
          else if (i === currentRound && !isBreak) { cls += ' active'; state = 'sürüyor'; }
          return `<li class="${cls}" title="Tur ${i + 1}: ${state}"><span class="sr-only">Tur ${i + 1}: ${state}</span></li>`;
        }).join('')}
      </ol>

      <div class="pomo-timer-ring">
        <svg viewBox="0 0 280 280" aria-hidden="true">
          <circle class="ring-bg" cx="140" cy="140" r="${RING_RADIUS}" />
          <circle class="ring-progress" id="pomo-ring" cx="140" cy="140" r="${RING_RADIUS}"
            stroke-dasharray="${CIRCUMFERENCE}"
            stroke-dashoffset="${CIRCUMFERENCE * (1 - progress)}" />
        </svg>
        <div class="pomo-time-display">
          <div class="pomo-time-text" id="pomo-time" role="timer" aria-label="Kalan süre">${formatTime(remainingSeconds)}</div>
          <div class="pomo-time-label" id="pomo-label">${phaseText()}${isRunning ? '' : ', duraklatıldı'}</div>
        </div>
      </div>

      <p class="pomo-session-info">${nextText()}</p>

      <div class="pomo-controls">
        <button type="button" class="btn btn-primary pomo-toggle" id="pomo-toggle"></button>
        <button type="button" class="btn" id="pomo-skip">
          ${icon('skip', 16)} ${isBreak ? 'Molayı atla' : 'Turu atla'}
        </button>
        <button type="button" class="btn btn-danger" id="pomo-cancel">
          ${icon('stop', 16)} Bitir
        </button>
      </div>
      <p class="pomo-shortcut-hint">Boşluk tuşu: duraklat / devam et</p>
      <p class="pomo-session-meta">${config.focus} dk odak · ${config.breakTime} dk mola · ${config.rounds} tur</p>
    </div>
  `;

  updateToggleButton();

  container.querySelector('#pomo-toggle').addEventListener('click', () => toggleTimer(container));

  container.querySelector('#pomo-skip').addEventListener('click', () => {
    stopInterval();
    advancePhase(container);
  });

  container.querySelector('#pomo-cancel').addEventListener('click', () => {
    stopInterval();
    isConfigured = false;
    currentRound = 0;
    isBreak = false;
    renderPomodoro(container);
  });
}

function updateToggleButton() {
  const btn = document.getElementById('pomo-toggle');
  if (btn) {
    btn.innerHTML = isRunning
      ? `${icon('pause', 16)} Duraklat`
      : `${icon('play', 16)} Devam et`;
  }
  const label = document.getElementById('pomo-label');
  if (label) label.textContent = `${phaseText()}${isRunning ? '' : ', duraklatıldı'}`;
}

function toggleTimer(container) {
  if (isRunning) {
    stopInterval();
  } else {
    startTimer(container);
  }
  updateToggleButton();
  syncTitle();
}

function startNewPhase() {
  totalSeconds = isBreak ? config.breakTime * 60 : config.focus * 60;
  remainingSeconds = totalSeconds;
}

function stopInterval() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
  isRunning = false;
}

function startTimer(container) {
  // Aynı anda tek bir zamanlayıcı çalışsın
  if (timerInterval) clearInterval(timerInterval);
  isRunning = true;
  updateToggleButton();
  syncTitle();

  timerInterval = setInterval(() => {
    if (remainingSeconds > 0) {
      remainingSeconds--;
      updateTick();
    } else {
      stopInterval();
      advancePhase(container);
    }
  }, 1000);
}

// Her saniye öğeleri yeniden bulur; sayfa yeniden çizildiyse de güncel kalır.
function updateTick() {
  const timeEl = document.getElementById('pomo-time');
  const ringEl = document.getElementById('pomo-ring');
  if (timeEl) timeEl.textContent = formatTime(remainingSeconds);
  if (ringEl && totalSeconds) {
    const progress = (totalSeconds - remainingSeconds) / totalSeconds;
    ringEl.style.strokeDashoffset = CIRCUMFERENCE * (1 - progress);
  }
  syncTitle();
}

function advancePhase(container) {
  if (!isBreak) {
    currentRound++;
    store.incrementPomodoroSessions();

    if (currentRound >= config.rounds) {
      notifyUser('Oturum tamamlandı', `${config.rounds} odak turu bitti.`);
      lastCompletedRounds = config.rounds;
      isConfigured = false;
      currentRound = 0;
      isBreak = false;
      stopInterval();
      renderPomodoro(container);
      return;
    }

    isBreak = true;
    notifyUser('Mola zamanı', `${currentRound}. tur bitti. ${config.breakTime} dk mola.`);
  } else {
    isBreak = false;
    notifyUser('Odak zamanı', `${currentRound + 1}. tur başlıyor.`);
  }

  startNewPhase();
  renderTimerScreen(container);
  startTimer(container);
}

/* Başlık, klavye, bildirimler */

function isPageVisible() {
  const page = document.getElementById('page-pomodoro');
  return !!(page && page.classList.contains('active'));
}

function syncTitle() {
  if (isRunning && isConfigured && isPageVisible()) {
    document.title = `${formatTime(remainingSeconds)} · ${phaseText()} · ${baseTitle}`;
  } else if (document.title !== baseTitle) {
    document.title = baseTitle;
  }
}

function bindKeyboard() {
  if (keyListenerBound) return;
  keyListenerBound = true;

  document.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' && e.key !== ' ') return;
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
    if (!isPageVisible() || !currentContainer) return;

    const el = document.activeElement;
    if (el) {
      const tag = el.tagName;
      // Odaktaki düğme kendi tıklamasını yapsın; yazı alanlarına karışma
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON' || el.isContentEditable) return;
    }

    e.preventDefault();
    if (!isConfigured) startSession(currentContainer);
    else toggleTimer(currentContainer);
  });

  // Sayfadan çıkıldığında başlığı geri al (sayfa değişimi .active sınıfıyla olur)
  const page = document.getElementById('page-pomodoro');
  if (page && 'MutationObserver' in window) {
    new MutationObserver(syncTitle).observe(page, { attributes: true, attributeFilter: ['class'] });
  }
}

function notifyUser(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body });
  }
}
