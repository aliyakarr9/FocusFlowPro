import { icon } from '../utils/icons.js';

let toastContainer = null;

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/** Eski kayıtlardaki XP açıklamaları emojiyle başlar: emojiyi at, kırp, sonra HTML için kaçır. */
function cleanReason(reason) {
    const plain = String(reason ?? '').replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '').trim();
    return escapeHtml(plain);
}

function ensureContainer() {
    if (!toastContainer || !toastContainer.isConnected) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'xp-toast-stack';
        toastContainer.setAttribute('role', 'status');
        toastContainer.setAttribute('aria-live', 'polite');
        document.body.appendChild(toastContainer);
    }
    return toastContainer;
}

function present(toast, duration) {
    ensureContainer().appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 250);
    }, duration);
}

export function showXPToast({ amount, reason }) {
    const toast = document.createElement('div');
    const isPositive = amount > 0;
    toast.className = `xp-toast ${isPositive ? 'is-gain' : 'is-loss'}`;
    toast.innerHTML = `
    <span class="xp-toast-amount">${isPositive ? '+' : ''}${Number(amount) || 0} XP</span>
    <span class="xp-toast-reason">${cleanReason(reason)}</span>
  `;
    present(toast, 2500);
}

export function showLevelUpToast(levelInfo) {
    const toast = document.createElement('div');
    toast.className = 'xp-toast xp-toast-level';
    toast.innerHTML = `
    <span class="xp-toast-level-icon">${icon(levelInfo.icon, 20) || icon('award', 20)}</span>
    <span class="xp-toast-level-text">
      <span class="xp-toast-level-title">Yeni seviye</span>
      <span class="xp-toast-level-detail">Seviye ${Number(levelInfo.level) || ''} · ${escapeHtml(levelInfo.title)}</span>
    </span>
  `;
    present(toast, 4000);
}
