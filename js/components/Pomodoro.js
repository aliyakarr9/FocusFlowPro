/* ============================================
   FocusFlow Pro — Pomodoro Session Planner (v4)
   User configures: focus time, break time, rounds
   Then auto-cycles through all sessions
   ============================================ */

import store from '../store.js';
import { formatTime } from '../utils/helpers.js';

const CIRCUMFERENCE = 2 * Math.PI * 120;

let timerInterval = null;
let config = { focus: 50, breakTime: 15, rounds: 5 };
let currentRound = 0;
let isBreak = false;
let isRunning = false;
let isConfigured = false;
let totalSeconds = 0;
let remainingSeconds = 0;

export function renderPomodoro(container) {
  if (!isConfigured) {
    renderConfigScreen(container);
  } else {
    renderTimerScreen(container);
  }
}

function renderConfigScreen(container) {
  container.innerHTML = `
    <div class="pomo-container">
      <div class="pomo-config-header">
        <div class="pomo-config-icon">🍅</div>
        <h2>Oturum Planla</h2>
        <p class="pomo-config-desc">Odaklanma süresini, mola süresini ve tekrar sayısını ayarla</p>
      </div>

      <div class="pomo-config-grid">
        <div class="pomo-config-card">
          <div class="config-card-icon">🎯</div>
          <div class="config-card-label">Odaklanma</div>
          <div class="config-stepper">
            <button class="stepper-btn" data-field="focus" data-dir="-1">−</button>
            <span class="stepper-value" id="cfg-focus">${config.focus}</span>
            <span class="stepper-unit">dk</span>
            <button class="stepper-btn" data-field="focus" data-dir="1">+</button>
          </div>
          <div class="config-presets">
            <button class="config-preset-btn ${config.focus === 25 ? 'active' : ''}" data-field="focus" data-val="25">25</button>
            <button class="config-preset-btn ${config.focus === 30 ? 'active' : ''}" data-field="focus" data-val="30">30</button>
            <button class="config-preset-btn ${config.focus === 45 ? 'active' : ''}" data-field="focus" data-val="45">45</button>
            <button class="config-preset-btn ${config.focus === 50 ? 'active' : ''}" data-field="focus" data-val="50">50</button>
          </div>
        </div>

        <div class="pomo-config-card">
          <div class="config-card-icon">☕</div>
          <div class="config-card-label">Mola</div>
          <div class="config-stepper">
            <button class="stepper-btn" data-field="breakTime" data-dir="-1">−</button>
            <span class="stepper-value" id="cfg-break">${config.breakTime}</span>
            <span class="stepper-unit">dk</span>
            <button class="stepper-btn" data-field="breakTime" data-dir="1">+</button>
          </div>
          <div class="config-presets">
            <button class="config-preset-btn ${config.breakTime === 5 ? 'active' : ''}" data-field="breakTime" data-val="5">5</button>
            <button class="config-preset-btn ${config.breakTime === 10 ? 'active' : ''}" data-field="breakTime" data-val="10">10</button>
            <button class="config-preset-btn ${config.breakTime === 15 ? 'active' : ''}" data-field="breakTime" data-val="15">15</button>
            <button class="config-preset-btn ${config.breakTime === 20 ? 'active' : ''}" data-field="breakTime" data-val="20">20</button>
          </div>
        </div>

        <div class="pomo-config-card">
          <div class="config-card-icon">🔁</div>
          <div class="config-card-label">Tekrar</div>
          <div class="config-stepper">
            <button class="stepper-btn" data-field="rounds" data-dir="-1">−</button>
            <span class="stepper-value" id="cfg-rounds">${config.rounds}</span>
            <span class="stepper-unit">tur</span>
            <button class="stepper-btn" data-field="rounds" data-dir="1">+</button>
          </div>
          <div class="config-presets">
            <button class="config-preset-btn ${config.rounds === 2 ? 'active' : ''}" data-field="rounds" data-val="2">2</button>
            <button class="config-preset-btn ${config.rounds === 3 ? 'active' : ''}" data-field="rounds" data-val="3">3</button>
            <button class="config-preset-btn ${config.rounds === 4 ? 'active' : ''}" data-field="rounds" data-val="4">4</button>
            <button class="config-preset-btn ${config.rounds === 5 ? 'active' : ''}" data-field="rounds" data-val="5">5</button>
          </div>
        </div>
      </div>

      <div class="pomo-summary">
        <div class="pomo-summary-item">
          <span class="summary-label">Toplam odaklanma</span>
          <span class="summary-value" id="total-focus">${config.focus * config.rounds} dk</span>
        </div>
        <div class="pomo-summary-item">
          <span class="summary-label">Toplam mola</span>
          <span class="summary-value" id="total-break">${config.breakTime * (config.rounds - 1)} dk</span>
        </div>
        <div class="pomo-summary-item">
          <span class="summary-label">Toplam süre</span>
          <span class="summary-value" id="total-time">${config.focus * config.rounds + config.breakTime * (config.rounds - 1)} dk</span>
        </div>
      </div>

      <button class="pomo-start-session" id="pomo-start-session">▶ Oturumu Başlat</button>

      <div class="pomo-total-stats">
        <div class="pomo-stat-item">
          <span class="pomo-stat-value">${store.pomodoroSessions}</span>
          <span class="pomo-stat-label">Toplam Oturum</span>
        </div>
        <div class="pomo-stat-item">
          <span class="pomo-stat-value">${Math.round(store.pomodoroSessions * 25 / 60)}s</span>
          <span class="pomo-stat-label">Toplam Odaklanma</span>
        </div>
      </div>
    </div>
  `;

  const limits = { focus: [5, 120], breakTime: [1, 60], rounds: [1, 20] };

  function updateSummary() {
    document.getElementById('total-focus').textContent = `${config.focus * config.rounds} dk`;
    document.getElementById('total-break').textContent = `${config.breakTime * (config.rounds - 1)} dk`;
    document.getElementById('total-time').textContent = `${config.focus * config.rounds + config.breakTime * (config.rounds - 1)} dk`;
  }

  // Steppers
  container.querySelectorAll('.stepper-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const field = btn.dataset.field;
      const dir = parseInt(btn.dataset.dir);
      const step = field === 'rounds' ? 1 : 5;
      config[field] = Math.max(limits[field][0], Math.min(limits[field][1], config[field] + dir * step));
      document.getElementById(`cfg-${field === 'breakTime' ? 'break' : field}`).textContent = config[field];
      // Update presets active state
      container.querySelectorAll(`.config-preset-btn[data-field="${field}"]`).forEach(p =>
        p.classList.toggle('active', parseInt(p.dataset.val) === config[field])
      );
      updateSummary();
    });
  });

  // Presets
  container.querySelectorAll('.config-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const field = btn.dataset.field;
      config[field] = parseInt(btn.dataset.val);
      document.getElementById(`cfg-${field === 'breakTime' ? 'break' : field}`).textContent = config[field];
      container.querySelectorAll(`.config-preset-btn[data-field="${field}"]`).forEach(p =>
        p.classList.toggle('active', parseInt(p.dataset.val) === config[field])
      );
      updateSummary();
    });
  });

  // Start session
  document.getElementById('pomo-start-session').addEventListener('click', () => {
    isConfigured = true;
    currentRound = 0;
    isBreak = false;
    startNewPhase();
    renderTimerScreen(container);
    startTimer(container);
  });

  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function renderTimerScreen(container) {
  const phaseLabel = isBreak ? '☕ Mola' : `🎯 Odaklanma ${currentRound + 1}/${config.rounds}`;
  const progressPercent = isBreak
    ? ((config.breakTime * 60 - remainingSeconds) / (config.breakTime * 60))
    : ((config.focus * 60 - remainingSeconds) / (config.focus * 60));

  container.innerHTML = `
    <div class="pomo-container">
      <div class="pomo-round-tracker">
        ${Array.from({ length: config.rounds }, (_, i) => {
    let cls = 'round-dot';
    if (i < currentRound) cls += ' completed';
    else if (i === currentRound && !isBreak) cls += ' active';
    return `<div class="${cls}"><span>${i + 1}</span></div>`;
  }).join('')}
      </div>

      <div class="pomo-timer-ring">
        <svg width="280" height="280" viewBox="0 0 280 280">
          <defs>
            <linearGradient id="pomoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:${isBreak ? '#34d399' : 'var(--accent)'}" />
              <stop offset="100%" style="stop-color:${isBreak ? '#6ee7b7' : '#a78bfa'}" />
            </linearGradient>
          </defs>
          <circle class="ring-bg" cx="140" cy="140" r="120" />
          <circle class="ring-progress" id="pomo-ring" cx="140" cy="140" r="120"
            stroke-dasharray="${CIRCUMFERENCE}"
            stroke-dashoffset="${CIRCUMFERENCE * (1 - progressPercent)}" />
        </svg>
        <div class="pomo-time-display">
          <div class="time-text" id="pomo-time">${formatTime(remainingSeconds)}</div>
          <div class="time-label" id="pomo-label">${phaseLabel}</div>
        </div>
      </div>

      <div class="pomo-session-info">
        <span>${config.focus}dk odaklanma · ${config.breakTime}dk mola · ${config.rounds} tur</span>
      </div>

      <div class="pomo-controls">
        <button class="pomo-btn primary" id="pomo-toggle">${isRunning ? '⏸ Durdur' : '▶ Devam'}</button>
        <button class="pomo-btn secondary" id="pomo-skip">⏭ ${isBreak ? 'Molayı Atla' : 'Odaklanmayı Atla'}</button>
        <button class="pomo-btn secondary danger" id="pomo-cancel">✕ Bitir</button>
      </div>
    </div>
  `;

  // Toggle play/pause
  document.getElementById('pomo-toggle').addEventListener('click', () => {
    if (isRunning) {
      clearInterval(timerInterval);
      isRunning = false;
      document.getElementById('pomo-toggle').textContent = '▶ Devam';
    } else {
      startTimer(container);
      document.getElementById('pomo-toggle').textContent = '⏸ Durdur';
    }
  });

  // Skip phase
  document.getElementById('pomo-skip').addEventListener('click', () => {
    clearInterval(timerInterval);
    isRunning = false;
    advancePhase(container);
  });

  // Cancel
  document.getElementById('pomo-cancel').addEventListener('click', () => {
    clearInterval(timerInterval);
    isRunning = false;
    isConfigured = false;
    currentRound = 0;
    renderPomodoro(container);
  });
}

function startNewPhase() {
  totalSeconds = isBreak ? config.breakTime * 60 : config.focus * 60;
  remainingSeconds = totalSeconds;
}

function startTimer(container) {
  isRunning = true;
  const timeEl = document.getElementById('pomo-time');
  const ringEl = document.getElementById('pomo-ring');
  const labelEl = document.getElementById('pomo-label');

  timerInterval = setInterval(() => {
    if (remainingSeconds > 0) {
      remainingSeconds--;
      if (timeEl) timeEl.textContent = formatTime(remainingSeconds);
      if (ringEl) {
        const progress = (totalSeconds - remainingSeconds) / totalSeconds;
        ringEl.style.strokeDashoffset = CIRCUMFERENCE * (1 - progress);
      }
    } else {
      clearInterval(timerInterval);
      isRunning = false;
      advancePhase(container);
    }
  }, 1000);
}

function advancePhase(container) {
  if (!isBreak) {
    // Just finished a focus session
    currentRound++;
    store.incrementPomodoroSessions();

    if (currentRound >= config.rounds) {
      // All rounds complete!
      notifyUser('Tebrikler! 🎉', `${config.rounds} tur odaklanma tamamlandı!`);
      isConfigured = false;
      currentRound = 0;
      renderPomodoro(container);
      return;
    }

    // Start break
    isBreak = true;
    notifyUser('Mola zamanı ☕', `${currentRound}. tur tamamlandı! ${config.breakTime} dk mola`);
  } else {
    // Just finished a break
    isBreak = false;
    notifyUser('Odaklanma zamanı 🎯', `${currentRound + 1}. tur başlıyor!`);
  }

  startNewPhase();
  renderTimerScreen(container);
  startTimer(container);
}

function notifyUser(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body });
  }
}
