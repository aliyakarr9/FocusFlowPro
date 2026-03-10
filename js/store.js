/* ============================================
   FocusFlow Pro — State Management (Store) v4
   Removed localStorage — server JSON file is
   the single source of truth.
   ============================================ */

import { generateId, calculateStreak, getXPForPriority, getLevelInfo, checkAchievements, generateDailyChallenges, shouldCreateRecurrence, toLocalDateStr } from './utils/helpers.js';

const DEFAULT_CATEGORIES = [
    { id: 'Yazılım', label: 'Yazılım', icon: '💻', color: '#38bdf8' },
    { id: 'Spor', label: 'Spor', icon: '🏃', color: '#fb923c' },
    { id: 'Üniversite', label: 'Üniversite', icon: '📚', color: '#a78bfa' },
    { id: 'Genel', label: 'Genel', icon: '📌', color: '#64748b' },
];

function getDefaultState() {
    return {
        tasks: [],
        habits: [],
        categories: DEFAULT_CATEGORIES,
        streak: 0,
        lastStreakDate: '',
        badgeDates: {},
        xp: 0,
        xpLog: [],
        achievements: {},
        totalTasksCompleted: 0,
        dailyChallenges: { date: '', items: [] },
        weeklyStats: { weekStart: '', tasksCompleted: 0, xpEarned: 0, pomodoroCount: 0, challengesCompleted: 0 },
        lastWeeklyReportDate: '',
        theme: 'dark',
        pomodoroSessions: 0,
        deletedStack: [],
        weeklySchedule: [],
        categoryMappings: {},
    };
}

class Store {
    constructor() {
        this._state = getDefaultState();
        this._saveTimer = null;
        this._pendingSave = false;
        this._serverReady = false;
        this._listeners = new Map();
        this._initFromServer();
    }

    /* ---- Pub / Sub ---- */
    on(event, callback) {
        if (!this._listeners.has(event)) this._listeners.set(event, []);
        this._listeners.get(event).push(callback);
    }

    _emit(event, data) {
        (this._listeners.get(event) || []).forEach(cb => cb(data));
    }

    /* ---- Persistence (Server-only, no localStorage) ---- */

    async _initFromServer() {
        const maxRetries = 5;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const res = await fetch('/api/data');
                if (res.ok) {
                    const data = await res.json();
                    this._state = { ...getDefaultState(), ...data };
                    // Ensure categories exist (migration)
                    if (!this._state.categories || this._state.categories.length === 0) {
                        this._state.categories = DEFAULT_CATEGORIES;
                    }
                    this._serverReady = true;
                    this._updateStreak();
                    this._initDailyChallenges();
                    this._processRecurringTasks();
                    // Refresh entire UI
                    this._emit('tasks-changed', { list: 'daily' });
                    this._emit('tasks-changed', { list: 'weekly' });
                    this._emit('habits-changed');
                    this._emit('stats-changed');
                    this._emit('streak-changed');
                    this._emit('categories-changed');
                    this._emit('challenges-changed');
                    this._emit('theme-changed', this._state.theme);
                    console.log('✅ Data loaded from server');
                    return;
                }
            } catch (e) {
                console.warn(`⚠️ Server connection attempt ${attempt}/${maxRetries}:`, e.message);
            }
            // Wait before retry (increasing delay)
            await new Promise(r => setTimeout(r, attempt * 500));
        }
        console.error('❌ Failed to connect to server — using default data.');
        this._serverReady = false;
    }

    async _saveToServer() {
        try {
            const res = await fetch('/api/data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this._state),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            this._pendingSave = false;
        } catch (e) {
            console.warn('⚠️ Failed to save to server, retrying in 3s:', e.message);
            this._pendingSave = true;
            setTimeout(() => this._saveToServer(), 3000);
        }
    }

    _save() {
        // Debounced server save (max once per 300ms)
        clearTimeout(this._saveTimer);
        this._saveTimer = setTimeout(() => this._saveToServer(), 300);
    }

    /* ---- Streak ---- */
    _updateStreak() {
        const prevStreak = this._state.streak;
        const result = calculateStreak(this._state);
        this._state.streak = result.streak;
        this._state.lastStreakDate = result.lastDate;
        this._state.badgeDates = result.badgeDates;

        // Daily-all-done bonus: give +25 XP when all daily tasks completed (only once per streak update)
        const dailyTasks = this._state.tasks.filter(t => t.list === 'daily');
        const allDone = dailyTasks.length > 0 && dailyTasks.every(t => t.completed);
        if (allDone && result.streak > prevStreak) {
            this._addXP(25, '🎯 Günlük görevler tamamlandı!');
        }
        this._save();
    }

    /* ---- XP System ---- */
    _addXP(amount, reason) {
        const prevLevel = getLevelInfo(this._state.xp).level;
        this._state.xp = Math.max(0, this._state.xp + amount);
        this._state.xpLog.unshift({
            amount, reason,
            date: new Date().toISOString(),
            totalXP: this._state.xp,
        });
        if (this._state.xpLog.length > 50) this._state.xpLog.length = 50;
        this._save();

        const newLevel = getLevelInfo(this._state.xp).level;
        this._emit('xp-changed', { amount, reason, totalXP: this._state.xp });
        if (newLevel > prevLevel) {
            this._emit('level-up', getLevelInfo(this._state.xp));
        }
    }

    /* ---- Achievements ---- */
    _checkAchievements() {
        const { earned, newlyEarned } = checkAchievements(this._state);
        this._state.achievements = earned;
        if (newlyEarned.length > 0) {
            for (const a of newlyEarned) {
                this._addXP(a.xp, `🏅 Başarım: ${a.name}`);
            }
            this._save();
            this._emit('achievement-unlocked', newlyEarned);
        }
    }

    /* ---- Daily Challenges ---- */
    _initDailyChallenges() {
        const result = generateDailyChallenges(this._state.dailyChallenges?.date);
        if (result) {
            this._state.dailyChallenges = result;
            this._save();
            this._emit('challenges-changed');
        }
    }

    _updateChallengeProgress(type, amount = 1) {
        const ch = this._state.dailyChallenges;
        if (!ch || !ch.items) return;
        let changed = false;
        ch.items.forEach(item => {
            if (item.done) return;
            if (item.type === type) {
                item.current = Math.min(item.target, item.current + amount);
                if (item.current >= item.target && !item.done) {
                    item.done = true;
                    this._addXP(item.xp, `🎯 Challenge: ${item.title}`);
                    this._state.weeklyStats.challengesCompleted = (this._state.weeklyStats.challengesCompleted || 0) + 1;
                    changed = true;
                }
            }
            // Special: all_daily check
            if (item.type === 'all_daily' && !item.done) {
                const dailyTasks = this._state.tasks.filter(t => t.list === 'daily');
                const allDone = dailyTasks.length > 0 && dailyTasks.every(t => t.completed);
                if (allDone) {
                    item.current = 1;
                    item.done = true;
                    this._addXP(item.xp, `🎯 Challenge: ${item.title}`);
                    changed = true;
                }
            }
        });
        if (changed) {
            this._save();
            this._emit('challenges-changed');
        }
    }

    /* ---- Recurring Tasks ---- */
    _processRecurringTasks() {
        const today = toLocalDateStr(new Date());
        const recurringTasks = this._state.tasks.filter(t => t.recurrence && t.recurrence !== 'none');
        let added = 0;
        recurringTasks.forEach(task => {
            if (shouldCreateRecurrence(task, today)) {
                // Check if already created for today
                const exists = this._state.tasks.some(t =>
                    t.recurringSourceId === task.id && t.createdAt?.startsWith(today)
                );
                if (!exists) {
                    const copy = {
                        id: generateId(),
                        title: task.title,
                        category: task.category,
                        priority: task.priority,
                        list: 'daily',
                        notes: task.notes || '',
                        subtasks: [],
                        completed: false,
                        createdAt: new Date().toISOString(),
                        recurringSourceId: task.id,
                    };
                    this._state.tasks.unshift(copy);
                    task.lastRecurrenceDate = today;
                    added++;
                }
            }
        });
        if (added > 0) {
            this._save();
            this._emit('tasks-changed', { list: 'daily' });
        }
    }

    /* ---- Weekly Stats ---- */
    _trackWeeklyStat(key, amount = 1) {
        if (!this._state.weeklyStats) {
            this._state.weeklyStats = { weekStart: '', tasksCompleted: 0, xpEarned: 0, pomodoroCount: 0, challengesCompleted: 0 };
        }
        const today = toLocalDateStr(new Date());
        const d = new Date(today + 'T00:00:00');
        const monday = new Date(d);
        monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
        const weekStart = toLocalDateStr(monday);
        if (this._state.weeklyStats.weekStart !== weekStart) {
            // New week — archive old and reset
            this._state.lastWeeklyStats = { ...this._state.weeklyStats };
            this._state.weeklyStats = { weekStart, tasksCompleted: 0, xpEarned: 0, pomodoroCount: 0, challengesCompleted: 0 };
        }
        this._state.weeklyStats[key] = (this._state.weeklyStats[key] || 0) + amount;
    }

    setLastWeeklyReportDate(date) {
        this._state.lastWeeklyReportDate = date;
        this._save();
    }

    /* ---- Getters ---- */
    get state() { return this._state; }
    get tasks() { return this._state.tasks; }
    get habits() { return this._state.habits; }
    get categories() { return this._state.categories; }
    get streak() { return this._state.streak; }
    get badgeDates() { return this._state.badgeDates; }
    get xp() { return this._state.xp; }
    get xpLog() { return this._state.xpLog; }
    get achievements() { return this._state.achievements; }
    get totalTasksCompleted() { return this._state.totalTasksCompleted; }
    get dailyChallenges() { return this._state.dailyChallenges; }
    get weeklyStats() { return this._state.weeklyStats; }
    get lastWeeklyReportDate() { return this._state.lastWeeklyReportDate; }
    get theme() { return this._state.theme; }
    get pomodoroSessions() { return this._state.pomodoroSessions; }
    get weeklySchedule() { return this._state.weeklySchedule; }
    get categoryMappings() { return this._state.categoryMappings; }
    getTasksByList(list) { return this._state.tasks.filter(t => t.list === list); }

    /* ---- Categories CRUD ---- */
    addCategory(label, icon, color) {
        const id = label.trim();
        if (this._state.categories.some(c => c.id === id)) return false;
        this._state.categories.push({ id, label: label.trim(), icon, color });
        this._save();
        this._emit('categories-changed');
        return true;
    }

    deleteCategory(id) {
        if (this._state.categories.length <= 1) return false;
        this._state.categories = this._state.categories.filter(c => c.id !== id);
        // Reassign tasks using this category to the first remaining
        const fallback = this._state.categories[0].id;
        this._state.tasks.forEach(t => { if (t.category === id) t.category = fallback; });
        this._save();
        this._emit('categories-changed');
        this._emit('tasks-changed', { list: 'daily' });
        this._emit('tasks-changed', { list: 'weekly' });
        return true;
    }

    updateCategory(id, updates) {
        const cat = this._state.categories.find(c => c.id === id);
        if (!cat) return;
        Object.assign(cat, updates);
        this._save();
        this._emit('categories-changed');
    }

    /* ---- Task CRUD ---- */
    addTask({ title, category = 'Genel', priority = 'medium', dueDate = '', list = 'daily', notes = '', recurrence = 'none' }) {
        const task = {
            id: generateId(),
            title: title.trim(),
            category,
            priority,
            dueDate,
            list,
            notes,
            recurrence,
            subtasks: [],
            completed: false,
            createdAt: new Date().toISOString(),
        };
        this._state.tasks.unshift(task);
        this._save();
        this._updateChallengeProgress('add_tasks');
        this._emit('tasks-changed', { list });
        this._emit('stats-changed');
        return task;
    }

    updateTask(id, updates) {
        const task = this._state.tasks.find(t => t.id === id);
        if (!task) return null;
        Object.assign(task, updates);
        // Sync linked (daily copy ↔ weekly source)
        if (task.sourceId) {
            const src = this._state.tasks.find(t => t.id === task.sourceId);
            if (src) {
                if ('completed' in updates) src.completed = updates.completed;
                if ('title' in updates) src.title = updates.title.replace(/^🔗\s*/, '');
            }
        }
        this._state.tasks.filter(t => t.sourceId === id).forEach(copy => {
            if ('completed' in updates) copy.completed = updates.completed;
        });
        this._save();
        this._emit('tasks-changed', { list: 'daily' });
        this._emit('tasks-changed', { list: 'weekly' });
        this._emit('stats-changed');
        return task;
    }

    toggleTask(id) {
        const task = this._state.tasks.find(t => t.id === id);
        if (!task) return;
        task.completed = !task.completed;
        // Sync linked
        if (task.sourceId) {
            const src = this._state.tasks.find(t => t.id === task.sourceId);
            if (src) src.completed = task.completed;
        }
        this._state.tasks.filter(t => t.sourceId === id).forEach(c => { c.completed = task.completed; });

        // XP for task completion
        const xpAmount = getXPForPriority(task.priority);
        if (task.completed) {
            this._state.totalTasksCompleted = (this._state.totalTasksCompleted || 0) + 1;
            this._addXP(xpAmount, `✅ Görev: ${task.title.substring(0, 30)}`);
            this._updateChallengeProgress('tasks');
            this._trackWeeklyStat('tasksCompleted');
            this._trackWeeklyStat('xpEarned', xpAmount);
        } else {
            this._state.totalTasksCompleted = Math.max(0, (this._state.totalTasksCompleted || 0) - 1);
            this._addXP(-xpAmount, `↩️ Geri alındı: ${task.title.substring(0, 30)}`);
        }

        this._save();
        this._updateStreak();
        this._checkAchievements();
        this._emit('tasks-changed', { list: 'daily' });
        this._emit('tasks-changed', { list: 'weekly' });
        this._emit('stats-changed');
        this._emit('streak-changed');
    }

    deleteTask(id) {
        const task = this._state.tasks.find(t => t.id === id);
        if (!task) return;
        this._state.deletedStack.push({ ...task });
        if (this._state.deletedStack.length > 10) this._state.deletedStack.shift();
        // Also remove linked copies
        this._state.tasks = this._state.tasks.filter(t => t.id !== id && t.sourceId !== id);
        // If deleting a copy, don't delete the source
        this._save();
        this._emit('tasks-changed', { list: 'daily' });
        this._emit('tasks-changed', { list: 'weekly' });
        this._emit('stats-changed');
        this._emit('task-deleted', task);
    }

    undoDelete() {
        if (this._state.deletedStack.length === 0) return null;
        const task = this._state.deletedStack.pop();
        this._state.tasks.unshift(task);
        this._save();
        this._emit('tasks-changed', { list: task.list });
        this._emit('stats-changed');
        return task;
    }

    clearCompleted(list) {
        // Collect IDs of completed tasks
        const completedIds = this._state.tasks
            .filter(t => t.list === list && t.completed)
            .map(t => t.id);
        // Remove completed + their linked daily copies
        this._state.tasks = this._state.tasks.filter(t => {
            if (t.list === list && t.completed) return false;
            // If a daily copy's source is in the completed list, remove it too
            if (t.sourceId && completedIds.includes(t.sourceId)) return false;
            return true;
        });
        this._save();
        this._emit('tasks-changed', { list: 'daily' });
        this._emit('tasks-changed', { list: 'weekly' });
        this._emit('stats-changed');
    }

    moveToDaily(id) {
        const task = this._state.tasks.find(t => t.id === id);
        if (!task) return;
        if (this._state.tasks.some(t => t.list === 'daily' && t.sourceId === id)) return false;
        const copy = {
            ...task,
            id: generateId(),
            list: 'daily',
            sourceId: id,
            title: `🔗 ${task.title}`,
            completed: task.completed,
            subtasks: task.subtasks ? task.subtasks.map(s => ({ ...s })) : [],
        };
        this._state.tasks.unshift(copy);
        this._save();
        this._emit('tasks-changed', { list: 'daily' });
        this._emit('stats-changed');
        return true;
    }

    /* ---- Subtasks ---- */
    addSubtask(taskId, title) {
        const task = this._state.tasks.find(t => t.id === taskId);
        if (!task) return;
        if (!task.subtasks) task.subtasks = [];
        task.subtasks.push({ id: generateId(), title: title.trim(), completed: false });
        this._save();
        this._emit('tasks-changed', { list: task.list });
    }

    toggleSubtask(taskId, subtaskId) {
        const task = this._state.tasks.find(t => t.id === taskId);
        if (!task?.subtasks) return;
        const sub = task.subtasks.find(s => s.id === subtaskId);
        if (sub) sub.completed = !sub.completed;
        this._save();
        this._emit('tasks-changed', { list: task.list });
    }

    deleteSubtask(taskId, subtaskId) {
        const task = this._state.tasks.find(t => t.id === taskId);
        if (!task?.subtasks) return;
        task.subtasks = task.subtasks.filter(s => s.id !== subtaskId);
        this._save();
        this._emit('tasks-changed', { list: task.list });
    }

    /* ---- Habits ---- */
    addHabit(name, icon = '🎯') {
        const habit = { id: generateId(), name: name.trim(), icon, history: {}, createdAt: new Date().toISOString() };
        this._state.habits.push(habit);
        this._save();
        this._emit('habits-changed');
        return habit;
    }

    toggleHabitDay(habitId, dateStr) {
        const habit = this._state.habits.find(h => h.id === habitId);
        if (!habit) return;
        const wasChecked = habit.history[dateStr];
        habit.history[dateStr] = !wasChecked;
        if (!habit.history[dateStr]) delete habit.history[dateStr];

        // XP for habit tracking
        if (!wasChecked) {
            this._addXP(5, `🧘 Alışkanlık: ${habit.name}`);
            this._updateChallengeProgress('habits');
        } else {
            this._addXP(-5, `↩️ Alışkanlık geri alındı: ${habit.name}`);
        }

        this._save();
        this._checkAchievements();
        this._emit('habits-changed');
    }

    deleteHabit(habitId) {
        this._state.habits = this._state.habits.filter(h => h.id !== habitId);
        this._save();
        this._emit('habits-changed');
    }

    /* ---- Reorder ---- */
    reorderTask(taskId, newIndex, list) {
        const listTasks = this._state.tasks.filter(t => t.list === list);
        const otherTasks = this._state.tasks.filter(t => t.list !== list);
        const idx = listTasks.findIndex(t => t.id === taskId);
        if (idx === -1) return;
        const [moved] = listTasks.splice(idx, 1);
        listTasks.splice(newIndex, 0, moved);
        this._state.tasks = [...listTasks, ...otherTasks];
        this._save();
        this._emit('tasks-changed', { list });
    }

    /* ---- Weekly Schedule ---- */
    setCategoryMappings(mappings) {
        this._state.categoryMappings = { ...this._state.categoryMappings, ...mappings };
        this._save();
    }

    setWeeklySchedule(entries) {
        this._state.weeklySchedule = entries;
        this._save();
        this._emit('schedule-changed');
    }

    clearWeeklySchedule() {
        this._state.weeklySchedule = [];
        this._save();
        this._emit('schedule-changed');
    }

    transferDayToDaily(dayName) {
        const dayEntries = this._state.weeklySchedule.filter(e => e.day === dayName);
        if (dayEntries.length === 0) return 0;
        let added = 0;
        const mappings = this._state.categoryMappings;
        dayEntries.forEach(entry => {
            // Skip duplicates — check if a task with same title+time exists in daily
            const title = `${entry.time} — ${entry.activity}`;
            const exists = this._state.tasks.some(t => t.list === 'daily' && t.title === title);
            if (exists) return;
            const category = mappings[entry.activity] || entry.category || 'Genel';
            const priority = entry.priority || 'medium';
            this.addTask({ title, category, priority, list: 'daily' });
            added++;
        });
        return added;
    }

    /* ---- Theme ---- */
    static THEMES = ['dark', 'light', 'ocean', 'sunset', 'forest', 'rose', 'nord', 'dracula'];

    setTheme(name) {
        if (!Store.THEMES.includes(name)) return;
        this._state.theme = name;
        this._save();
        this._emit('theme-changed', this._state.theme);
    }

    toggleTheme() {
        const idx = Store.THEMES.indexOf(this._state.theme);
        const next = Store.THEMES[(idx + 1) % Store.THEMES.length];
        this.setTheme(next);
    }

    /* ---- Pomodoro ---- */
    incrementPomodoroSessions() {
        this._state.pomodoroSessions++;
        this._addXP(15, '🍅 Pomodoro oturumu tamamlandı');
        this._updateChallengeProgress('pomodoro');
        this._trackWeeklyStat('pomodoroCount');
        this._trackWeeklyStat('xpEarned', 15);
        this._checkAchievements();
        this._save();
        this._emit('stats-changed');
    }

    /* ---- Export ---- */
    exportData() {
        const blob = new Blob([JSON.stringify(this._state, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `focusflow_backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    /* ---- Import ---- */
    importData() {
        return new Promise((resolve, reject) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) { reject('Dosya seçilmedi'); return; }
                const reader = new FileReader();
                reader.onload = (ev) => {
                    try {
                        const data = JSON.parse(ev.target.result);
                        // Validate: must have at least tasks array
                        if (!data || typeof data !== 'object') {
                            reject('Geçersiz JSON dosyası');
                            return;
                        }
                        // Merge with defaults to ensure all fields exist
                        this._state = { ...getDefaultState(), ...data };
                        this._save();
                        this._updateStreak();
                        // Emit all events to refresh UI
                        this._emit('tasks-changed', { list: 'daily' });
                        this._emit('tasks-changed', { list: 'weekly' });
                        this._emit('habits-changed');
                        this._emit('stats-changed');
                        this._emit('streak-changed');
                        this._emit('categories-changed');
                        this._emit('theme-changed', this._state.theme);
                        resolve(data);
                    } catch (err) {
                        reject('JSON dosyası okunamadı: ' + err.message);
                    }
                };
                reader.onerror = () => reject('Dosya okunamadı');
                reader.readAsText(file);
            });
            input.click();
        });
    }
}

export default new Store();
