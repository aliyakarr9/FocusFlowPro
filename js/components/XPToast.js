/* ============================================
   FocusFlow Pro — XP Toast Notifications
   ============================================ */

let toastContainer = null;

function ensureContainer() {
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'xp-toast-container';
        document.body.appendChild(toastContainer);
    }
    return toastContainer;
}

export function showXPToast({ amount, reason }) {
    const container = ensureContainer();
    const toast = document.createElement('div');
    const isPositive = amount > 0;
    toast.className = `xp-toast ${isPositive ? 'xp-gain' : 'xp-loss'}`;
    toast.innerHTML = `
    <span class="xp-toast-amount">${isPositive ? '+' : ''}${amount} XP</span>
    <span class="xp-toast-reason">${reason}</span>
  `;
    container.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => toast.classList.add('show'));

    setTimeout(() => {
        toast.classList.remove('show');
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 400);
    }, 2500);
}

export function showLevelUpToast(levelInfo) {
    const container = ensureContainer();
    const toast = document.createElement('div');
    toast.className = 'xp-toast level-up-toast';
    toast.innerHTML = `
    <div class="level-up-icon">${levelInfo.icon}</div>
    <div class="level-up-text">
      <div class="level-up-title">🎉 Seviye Atladın!</div>
      <div class="level-up-detail">Seviye ${levelInfo.level}: ${levelInfo.title}</div>
    </div>
  `;
    container.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('show'));

    setTimeout(() => {
        toast.classList.remove('show');
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 400);
    }, 4000);
}
