/* ============================================
   FocusFlow Pro — Main App Controller (v2)
   ============================================ */

import store from './store.js';
import { renderSidebar, updateSidebarCounts, updateSidebarStreak, updateSidebarXP } from './components/Sidebar.js';
import { renderTaskForm } from './components/TaskForm.js';
import { renderTaskList } from './components/TaskList.js';
import { renderFilterBar } from './components/FilterBar.js';
import { renderPomodoro } from './components/Pomodoro.js';
import { renderAnalytics, renderBadges } from './components/Analytics.js';
import { renderHabits } from './components/HabitTracker.js';
import { renderSchedule } from './components/Schedule.js';
import { showToast } from './components/TaskCard.js';
import { showXPToast, showLevelUpToast } from './components/XPToast.js';
import { renderDailyChallenges, updateChallengesUI } from './components/DailyChallenges.js';
import { checkAndShowWeeklyReport, showWeeklyReport } from './components/WeeklyReport.js';
import { getMotivationalQuote } from './utils/helpers.js';
import { renderAIChatWidget } from './components/AIChat.js';

/* Theme metadata for the picker */
const THEME_META = [
    { id: 'dark', name: '🌙 Dark', colors: ['#0f0f1a', '#1a1a2e', '#818cf8'] },
    { id: 'light', name: '☀️ Light', colors: ['#f8fafc', '#ffffff', '#6366f1'] },
    { id: 'ocean', name: '🌊 Ocean', colors: ['#0a192f', '#1d3461', '#22d3ee'] },
    { id: 'sunset', name: '🌅 Sunset', colors: ['#1a0e0a', '#3d2419', '#f97316'] },
    { id: 'forest', name: '🌲 Forest', colors: ['#0a1a0f', '#1a3324', '#22c55e'] },
    { id: 'rose', name: '🌹 Rose', colors: ['#1a0a14', '#3d1a30', '#f43f5e'] },
    { id: 'nord', name: '❄️ Nord', colors: ['#2e3440', '#434c5e', '#88c0d0'] },
    { id: 'dracula', name: '🧛 Dracula', colors: ['#282a36', '#44475a', '#bd93f9'] },
];

class App {
    constructor() {
        this.currentPage = 'daily';
        this.filters = { daily: {}, weekly: {} };
        this.sortBy = { daily: 'default', weekly: 'default' };
        this.init();
    }

    init() {
        document.documentElement.setAttribute('data-theme', store.theme);
        renderSidebar();
        this.navigateTo('daily');
        this.updateMotivation();
        this.bindEvents();
        this.bindKeyboardShortcuts();
        this.buildThemePicker();
        renderAIChatWidget();
        // Check weekly report after short delay
        setTimeout(() => checkAndShowWeeklyReport(), 2000);
    }

    buildThemePicker() {
        const wrapper = document.getElementById('theme-picker-wrapper');
        if (!wrapper) return;

        const dropdown = document.createElement('div');
        dropdown.className = 'theme-picker-dropdown';
        dropdown.id = 'theme-dropdown';

        const title = document.createElement('div');
        title.className = 'theme-picker-title';
        title.textContent = 'Tema Seç';
        dropdown.appendChild(title);

        THEME_META.forEach(t => {
            const btn = document.createElement('button');
            btn.className = `theme-option${store.theme === t.id ? ' active' : ''}`;
            btn.dataset.theme = t.id;

            const colorDots = document.createElement('span');
            colorDots.className = 'theme-option-colors';
            t.colors.forEach(c => {
                const dot = document.createElement('span');
                dot.className = 'theme-color-dot';
                dot.style.background = c;
                colorDots.appendChild(dot);
            });

            const nameSpan = document.createElement('span');
            nameSpan.className = 'theme-option-name';
            nameSpan.textContent = t.name;

            const check = document.createElement('span');
            check.className = 'theme-option-check';
            check.textContent = '✓';

            btn.append(colorDots, nameSpan, check);
            btn.addEventListener('click', () => {
                store.setTheme(t.id);
                this.closeThemeDropdown();
            });
            dropdown.appendChild(btn);
        });

        wrapper.appendChild(dropdown);
    }

    toggleThemeDropdown() {
        const dd = document.getElementById('theme-dropdown');
        if (dd) dd.classList.toggle('open');
    }

    closeThemeDropdown() {
        const dd = document.getElementById('theme-dropdown');
        if (dd) dd.classList.remove('open');
    }

    bindEvents() {
        // Navigation
        window.addEventListener('navigate', (e) => this.navigateTo(e.detail.page));

        // Store events — always refresh both lists on task change for sync
        store.on('tasks-changed', ({ list }) => {
            // Always update sidebar counts
            updateSidebarCounts();
            // Refresh the current page if it matches
            if (this.currentPage === 'daily' || this.currentPage === 'weekly' || this.currentPage === 'analytics') {
                this.refreshCurrentPage();
            }
        });

        store.on('streak-changed', () => {
            updateSidebarStreak();
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

        store.on('challenges-changed', () => {
            updateChallengesUI();
        });

        store.on('achievement-unlocked', (achievements) => {
            achievements.forEach(a => {
                showToast(`🏅 Başarım Açıldı: ${a.name}!`, 'success');
            });
            if (this.currentPage === 'badges') this.refreshCurrentPage();
        });

        store.on('theme-changed', (theme) => {
            document.documentElement.setAttribute('data-theme', theme);
            this.updateThemeButton();
            // Update active state in dropdown
            document.querySelectorAll('.theme-option').forEach(opt => {
                opt.classList.toggle('active', opt.dataset.theme === theme);
            });
        });

        store.on('task-deleted', (task) => {
            showToast('Görev silindi', 'delete');
        });

        store.on('habits-changed', () => {
            if (this.currentPage === 'habits') this.refreshCurrentPage();
        });

        // Theme picker toggle
        document.getElementById('theme-toggle')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleThemeDropdown();
        });

        // Close dropdown on outside click
        document.addEventListener('click', (e) => {
            const wrapper = document.getElementById('theme-picker-wrapper');
            if (wrapper && !wrapper.contains(e.target)) {
                this.closeThemeDropdown();
            }
        });

        // Sidebar toggle (mobile)
        document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('open');
        });
    }

    bindKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + N = Quick add focus
            if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
                e.preventDefault();
                const input = document.querySelector('.task-input-row input[type="text"]');
                if (input) input.focus();
            }

            // Ctrl/Cmd + Z = Undo delete
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                const result = store.undoDelete();
                if (result) showToast('Görev geri alındı!', 'success');
            }

            // 1-5 = Navigate pages
            if (!e.ctrlKey && !e.metaKey && !e.altKey && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
                const pages = { '1': 'daily', '2': 'weekly', '3': 'pomodoro', '4': 'habits', '5': 'analytics', '6': 'badges', '7': 'schedule' };
                if (pages[e.key]) {
                    this.navigateTo(pages[e.key]);
                    // Update sidebar active
                    document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.page === pages[e.key]));
                }
            }

            // Escape = close theme dropdown
            if (e.key === 'Escape') {
                this.closeThemeDropdown();
            }
        });
    }

    navigateTo(page) {
        this.currentPage = page;

        const titles = {
            daily: '📋 Bugünün Görevleri',
            weekly: '📅 Haftalık Plan',
            pomodoro: '🍅 Pomodoro Zamanlayıcı',
            habits: '🧘 Alışkanlık Takibi',
            analytics: '📊 Analiz Paneli',
            badges: '🏅 Rozet Koleksiyonu',
            schedule: '🗓️ Ders Programı',
        };

        const headerTitle = document.getElementById('page-title');
        if (headerTitle) headerTitle.textContent = titles[page] || '';

        document.querySelectorAll('.page-view').forEach(p => p.classList.remove('active'));

        const pageEl = document.getElementById(`page-${page}`);
        if (pageEl) {
            pageEl.classList.add('active');
            this.renderPage(page, pageEl);
        }

        document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.page === page));
        this.updateThemeButton();

        // Close mobile sidebar
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

    updateThemeButton() {
        const btn = document.getElementById('theme-toggle');
        if (!btn) return;
        const meta = THEME_META.find(t => t.id === store.theme);
        btn.textContent = meta ? meta.name.split(' ')[0] : '🎨';
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

