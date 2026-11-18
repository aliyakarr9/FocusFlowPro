import store from './store.js';
import { renderSidebar, updateSidebarCounts, updateSidebarXP } from './components/Sidebar.js';
import { renderTaskForm } from './components/TaskForm.js';
import { renderTaskList } from './components/TaskList.js';
import { renderFilterBar } from './components/FilterBar.js';
import { renderPomodoro } from './components/Pomodoro.js';
import { renderAnalytics, renderBadges } from './components/Analytics.js';
import { renderHabits } from './components/HabitTracker.js';
import { renderSchedule } from './components/Schedule.js';
import { showToast } from './components/TaskCard.js';
import { showXPToast, showLevelUpToast } from './components/XPToast.js';
import { renderDailyChallenges } from './components/DailyChallenges.js';
import { checkAndShowWeeklyReport } from './components/WeeklyReport.js';
import { getMotivationalQuote } from './utils/helpers.js';
import { renderAIChatWidget, toggleAIChat, closeAIChat, isAIChatOpen } from './components/AIChat.js';
import { icon } from './utils/icons.js';

const PAGE_TITLES = {
    daily: 'Bugün',
    weekly: 'Haftalık',
    pomodoro: 'Pomodoro',
    habits: 'Alışkanlıklar',
    analytics: 'Analiz',
    badges: 'Koleksiyon',
    schedule: 'Ders Programı',
};

const PAGE_KEYS = { '1': 'daily', '2': 'weekly', '3': 'pomodoro', '4': 'habits', '5': 'analytics', '6': 'badges', '7': 'schedule' };

const THEME_MODES = [
    { id: 'light', label: 'Açık', icon: 'sun' },
    { id: 'dark', label: 'Koyu', icon: 'moon' },
    { id: 'system', label: 'Sistem', icon: 'monitor' },
];

const ACCENTS = [
    { id: 'tomato', label: 'Domates' },
    { id: 'forest', label: 'Orman' },
    { id: 'ocean', label: 'Okyanus' },
    { id: 'amber', label: 'Kehribar' },
    { id: 'rose', label: 'Gül' },
    { id: 'graphite', label: 'Grafit' },
];

const APPEARANCE_KEY = 'focusflow-appearance';

const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
const MOD = isMac ? '⌘' : 'Ctrl';

const SHORTCUTS = [
    ['N', 'Yeni görev yaz'],
    ['/', 'Görevlerde ara'],
    [`${MOD} K`, 'Asistanı aç veya kapat'],
    ['1 – 7', 'Sayfalar arasında geç'],
    [`${MOD} Z`, 'Silinen son görevi geri al'],
    ['Esc', 'Açık pencereyi kapat'],
    ['?', 'Bu listeyi göster'],
];

function isTyping() {
    const el = document.activeElement;
    if (!el) return false;
    return ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable;
}

class App {
    constructor() {
        this.currentPage = 'daily';
        this.filters = { daily: {}, weekly: {} };
        this.sortBy = { daily: 'default', weekly: 'default' };
        this.systemDark = window.matchMedia('(prefers-color-scheme: dark)');
        this.init();
    }

    init() {
        this.applyTheme();
        const sidebarToggle = document.getElementById('sidebar-toggle');
        if (sidebarToggle) sidebarToggle.innerHTML = icon('menu', 20);
        const shortcutsBtn = document.getElementById('shortcuts-btn');
        if (shortcutsBtn) shortcutsBtn.innerHTML = icon('keyboard', 18);
        renderSidebar();
        this.navigateTo('daily');
        this.updateMotivation();
        this.buildAppearancePanel();
        this.bindEvents();
        this.bindKeyboardShortcuts();
        renderAIChatWidget();
        setTimeout(() => checkAndShowWeeklyReport(), 2000);
    }

    /* Tema */

    /* Veri yüklenene kadar son kullanılan görünüm uygulanır (açılışta renk sıçraması olmasın). */
    appearance() {
        if (store.isServerReady) {
            const current = { theme: store.theme, accent: store.accent || 'tomato' };
            try { localStorage.setItem(APPEARANCE_KEY, JSON.stringify(current)); } catch (e) { /* yok say */ }
            return current;
        }
        try {
            const cached = JSON.parse(localStorage.getItem(APPEARANCE_KEY) || 'null');
            if (cached && typeof cached.theme === 'string') return { theme: cached.theme, accent: cached.accent || 'tomato' };
        } catch (e) { /* yok say */ }
        return { theme: store.theme, accent: store.accent || 'tomato' };
    }

    resolvedTheme(theme) {
        if (theme === 'system') return this.systemDark.matches ? 'dark' : 'light';
        return theme === 'light' ? 'light' : 'dark';
    }

    applyTheme() {
        const root = document.documentElement;
        const { theme, accent } = this.appearance();
        root.setAttribute('data-theme', this.resolvedTheme(theme));
        root.setAttribute('data-accent', accent);
        this.updateThemeButton();
        this.updateAppearancePanel();
    }

    updateThemeButton() {
        const btn = document.getElementById('theme-toggle');
        if (btn) btn.innerHTML = icon('palette', 18);
    }

    buildAppearancePanel() {
        const wrapper = document.getElementById('appearance-wrapper');
        if (!wrapper) return;

        const panel = document.createElement('div');
        panel.className = 'appearance-panel';
        panel.id = 'appearance-panel';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-label', 'Görünüm');
        panel.innerHTML = `
            <div class="appearance-label">Tema</div>
            <div class="segmented appearance-modes">
                ${THEME_MODES.map(m => `<button data-mode="${m.id}">${icon(m.icon, 15)}${m.label}</button>`).join('')}
            </div>
            <div class="appearance-label">Vurgu rengi</div>
            <div class="appearance-accents">
                ${ACCENTS.map(a => `
                    <button class="accent-swatch" data-accent-id="${a.id}" title="${a.label}" aria-label="${a.label}">
                        <span class="accent-dot" data-accent="${a.id}"></span>
                        <span class="accent-name">${a.label}</span>
                    </button>`).join('')}
            </div>
        `;
        wrapper.appendChild(panel);

        panel.querySelectorAll('[data-mode]').forEach(btn => {
            btn.addEventListener('click', () => store.setTheme(btn.dataset.mode));
        });
        panel.querySelectorAll('[data-accent-id]').forEach(btn => {
            btn.addEventListener('click', () => store.setAccent(btn.dataset.accentId));
        });
        this.updateAppearancePanel();
    }

    updateAppearancePanel() {
        const panel = document.getElementById('appearance-panel');
        if (!panel) return;
        panel.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('active', b.dataset.mode === store.theme));
        panel.querySelectorAll('[data-accent-id]').forEach(b => b.classList.toggle('active', b.dataset.accentId === store.accent));
    }

    toggleAppearancePanel(force) {
        const panel = document.getElementById('appearance-panel');
        const btn = document.getElementById('theme-toggle');
        if (!panel) return;
        const open = force !== undefined ? force : !panel.classList.contains('open');
        panel.classList.toggle('open', open);
        btn?.setAttribute('aria-expanded', String(open));
    }

    /* Bağlantı uyarısı */

    showConnectionBanner(status) {
        let banner = document.getElementById('connection-banner');
        if (status === 'online') {
            banner?.remove();
            return;
        }
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'connection-banner';
            banner.className = 'connection-banner';
            banner.setAttribute('role', 'alert');
            document.querySelector('.main-content')?.prepend(banner);
        }
        if (status === 'offline') {
            banner.innerHTML = `
                ${icon('alert', 16)}
                <span>Veriler yüklenemedi. Sunucuya ulaşılana kadar yaptığın değişiklikler kaydedilmez.</span>
                <button class="btn btn-sm" id="connection-retry">Yeniden dene</button>
            `;
            banner.querySelector('#connection-retry').addEventListener('click', async (e) => {
                e.target.disabled = true;
                e.target.textContent = 'Deneniyor';
                await store.retryConnection();
            });
        } else {
            banner.innerHTML = `
                ${icon('alert', 16)}
                <span>Son değişiklikler kaydedilemedi. Yeniden deneniyor.</span>
            `;
        }
    }

    /* Kısayol listesi */

    showShortcuts() {
        document.querySelector('.modal-overlay')?.remove();
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-box" role="dialog" aria-label="Klavye kısayolları">
                <div class="modal-header">
                    <h3>Klavye kısayolları</h3>
                    <button class="modal-close" aria-label="Kapat">${icon('x', 16)}</button>
                </div>
                <div class="shortcut-list">
                    ${SHORTCUTS.map(([keys, label]) => `
                        <div class="shortcut-row"><span>${label}</span><kbd>${keys}</kbd></div>
                    `).join('')}
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    }

    /* Olaylar */

    bindEvents() {
        window.addEventListener('navigate', (e) => this.navigateTo(e.detail.page));

        store.on('tasks-changed', () => {
            updateSidebarCounts();
            if (this.currentPage === 'daily' || this.currentPage === 'weekly' || this.currentPage === 'analytics') {
                this.refreshCurrentPage();
            }
        });

        store.on('streak-changed', () => {
            updateSidebarXP();
            if (this.currentPage === 'badges') this.refreshCurrentPage();
        });

        store.on('stats-changed', () => {
            if (this.currentPage === 'analytics') this.refreshCurrentPage();
        });

        store.on('xp-changed', (data) => {
            updateSidebarXP();
            if (data.amount !== 0) showXPToast(data);
            if (this.currentPage === 'badges') this.refreshCurrentPage();
        });

        store.on('level-up', (levelInfo) => {
            showLevelUpToast(levelInfo);
        });

        // Günlük hedefler: veri sonradan yüklendiğinde de kutu görünsün
        store.on('challenges-changed', () => {
            if (this.currentPage !== 'daily') return;
            const pageEl = document.getElementById('page-daily');
            if (!pageEl) return;
            pageEl.querySelector('.daily-challenges-mini')?.remove();
            renderDailyChallenges(pageEl);
        });

        store.on('achievement-unlocked', (achievements) => {
            achievements.forEach(a => {
                showToast(`Başarım açıldı: ${a.name}`, 'success');
            });
            if (this.currentPage === 'badges') this.refreshCurrentPage();
        });

        store.on('theme-changed', () => this.applyTheme());
        this.systemDark.addEventListener('change', () => this.applyTheme());

        store.on('task-deleted', () => {
            showToast('Görev silindi', 'delete');
        });

        store.on('habits-changed', () => {
            if (this.currentPage === 'habits') this.refreshCurrentPage();
        });

        store.on('schedule-changed', () => {
            if (this.currentPage === 'schedule') this.refreshCurrentPage();
        });

        store.on('categories-changed', () => {
            if (this.currentPage === 'daily' || this.currentPage === 'weekly') this.refreshCurrentPage();
        });

        store.on('connection', (status) => this.showConnectionBanner(status));

        document.getElementById('theme-toggle')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleAppearancePanel();
        });
        document.addEventListener('click', (e) => {
            const wrapper = document.getElementById('appearance-wrapper');
            if (wrapper && !wrapper.contains(e.target)) this.toggleAppearancePanel(false);
        });

        document.getElementById('shortcuts-btn')?.addEventListener('click', () => this.showShortcuts());

        document.getElementById('sidebar-toggle')?.addEventListener('click', (e) => {
            e.stopPropagation();
            document.getElementById('sidebar').classList.toggle('open');
        });
        document.addEventListener('click', (e) => {
            const sidebar = document.getElementById('sidebar');
            if (sidebar?.classList.contains('open') && !sidebar.contains(e.target)) sidebar.classList.remove('open');
        });
    }

    focusNewTask() {
        if (this.currentPage !== 'daily' && this.currentPage !== 'weekly') this.navigateTo('daily');
        const input = document.querySelector('.page-view.active .task-input-row input[type="text"]');
        if (input) input.focus();
    }

    bindKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            const mod = e.ctrlKey || e.metaKey;

            // Esc: en üstteki açık şeyi kapat
            if (e.key === 'Escape') {
                const modal = [...document.querySelectorAll('.modal-overlay')].pop();
                if (modal) { modal.remove(); return; }
                const panel = document.getElementById('appearance-panel');
                if (panel?.classList.contains('open')) { this.toggleAppearancePanel(false); return; }
                if (isAIChatOpen()) { closeAIChat(); return; }
                const sidebar = document.getElementById('sidebar');
                if (sidebar?.classList.contains('open')) { sidebar.classList.remove('open'); return; }
                if (isTyping()) document.activeElement.blur();
                return;
            }

            if (mod && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                toggleAIChat();
                return;
            }

            if (mod && e.key.toLowerCase() === 'n') {
                e.preventDefault();
                this.focusNewTask();
                return;
            }

            // Buradan sonrası yalnızca yazı yazılmıyorken ve pencere açık değilken
            if (isTyping() || document.querySelector('.modal-overlay')) return;

            if (mod && e.key.toLowerCase() === 'z') {
                const result = store.undoDelete();
                if (result) showToast('Görev geri alındı', 'success');
                return;
            }

            if (mod || e.altKey) return;

            if (e.key === 'n' || e.key === 'N') {
                e.preventDefault();
                this.focusNewTask();
            } else if (e.key === '/') {
                const search = document.querySelector('.page-view.active #filter-search');
                if (search) { e.preventDefault(); search.focus(); }
            } else if (e.key === '?') {
                e.preventDefault();
                this.showShortcuts();
            } else if (PAGE_KEYS[e.key]) {
                this.navigateTo(PAGE_KEYS[e.key]);
            }
        });
    }

    /* Sayfalar */

    navigateTo(page) {
        this.currentPage = page;

        const headerTitle = document.getElementById('page-title');
        if (headerTitle) headerTitle.textContent = PAGE_TITLES[page] || '';

        const subtitle = document.getElementById('page-subtitle');
        if (subtitle) {
            subtitle.textContent = page === 'daily'
                ? new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' })
                : '';
        }

        document.querySelectorAll('.page-view').forEach(p => p.classList.remove('active'));

        const pageEl = document.getElementById(`page-${page}`);
        if (pageEl) {
            pageEl.classList.add('active');
            this.renderPage(page, pageEl);
        }

        document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.page === page));

        document.getElementById('sidebar')?.classList.remove('open');
    }

    renderPage(page, container) {
        container.innerHTML = '';
        switch (page) {
            case 'daily': this.renderTaskPage(container, 'daily'); renderDailyChallenges(container); break;
            case 'weekly': this.renderTaskPage(container, 'weekly'); break;
            case 'pomodoro': renderPomodoro(container); break;
            case 'habits': renderHabits(container); break;
            case 'analytics': renderAnalytics(container); break;
            case 'badges': renderBadges(container); break;
            case 'schedule': renderSchedule(container); break;
        }
    }

    renderTaskPage(container, list) {
        renderTaskForm(container, list);
        const filterRef = renderFilterBar(container, (filterState) => {
            this.filters[list] = filterState;
            this.sortBy[list] = filterState.sort;
            renderTaskList(container, list, filterState, filterState.sort);
        });
        this.filters[list] = filterRef.getState();
        renderTaskList(container, list, this.filters[list], this.sortBy[list]);
    }

    refreshCurrentPage() {
        const pageEl = document.getElementById(`page-${this.currentPage}`);
        if (!pageEl) return;

        if (this.currentPage === 'daily' || this.currentPage === 'weekly') {
            const list = this.currentPage;
            const taskListEl = pageEl.querySelector('.task-list');
            const progressEl = pageEl.querySelector('.progress-section');
            if (taskListEl) taskListEl.remove();
            if (progressEl) progressEl.remove();
            renderTaskList(pageEl, list, this.filters[list] || {}, this.sortBy[list] || 'default');
        } else {
            this.renderPage(this.currentPage, pageEl);
        }
    }

    updateMotivation() {
        const el = document.getElementById('motivation-text');
        if (!el) return;

        let lastQuote = '';
        const setQuote = () => {
            let q;
            do { q = getMotivationalQuote(); } while (q === lastQuote);
            lastQuote = q;

            el.style.transition = 'opacity 0.5s ease';
            el.style.opacity = '0';
            setTimeout(() => {
                el.textContent = q;
                el.style.opacity = '1';
            }, 500);
        };

        el.textContent = getMotivationalQuote();
        setInterval(setQuote, 60000);
    }
}

document.addEventListener('DOMContentLoaded', () => new App());
