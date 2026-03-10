/* ============================================
   FocusFlow Pro — Utility Helpers (v4)
   Added: toLocalDateStr, getUrgencyLevel
   Fixed: calculateStreak uses local dates
   ============================================ */

export function generateId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Always use this instead of toISOString().split('T')[0] — avoids UTC offset bugs */
export function toLocalDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatTime(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  const diff = Math.round((target - today) / (1000 * 60 * 60 * 24));

  if (diff === 0) return 'Bugün';
  if (diff === 1) return 'Yarın';
  if (diff === -1) return 'Dün';
  if (diff < -1) return `${Math.abs(diff)} gün önce`;
  if (diff <= 7) return `${diff} gün sonra`;
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

export function isOverdue(dateStr) {
  if (!dateStr) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + 'T00:00:00');
  return target < today;
}

export function isDueToday(dateStr) {
  if (!dateStr) return false;
  const today = toLocalDateStr(new Date());
  return dateStr === today;
}

/**
 * Returns urgency level for a task based on due date proximity
 * 'critical' = overdue or due today
 * 'high' = due within 1 day
 * 'medium' = due within 3 days
 * 'low' = due within 7 days
 * null = no urgency
 */
export function getUrgencyLevel(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + 'T00:00:00');
  const diff = Math.round((target - today) / (1000 * 60 * 60 * 24));

  if (diff < 0) return 'critical';   // Overdue
  if (diff === 0) return 'critical';  // Due today
  if (diff === 1) return 'high';      // Due tomorrow
  if (diff <= 3) return 'medium';     // 2-3 days
  if (diff <= 7) return 'low';        // 4-7 days
  return null;
}

export function getUrgencyLabel(level) {
  switch (level) {
    case 'critical': return '🔴 ACİL';
    case 'high': return '🟠 Yakın';
    case 'medium': return '🟡 Yaklaşıyor';
    case 'low': return '🟢 Planlı';
    default: return '';
  }
}

export function calculateProgress(tasks) {
  if (!tasks || tasks.length === 0) return 0;
  return Math.round((tasks.filter(t => t.completed).length / tasks.length) * 100);
}

export function calculateStreak(data) {
  const today = toLocalDateStr(new Date());
  const yd = new Date(); yd.setDate(yd.getDate() - 1);
  const yesterday = toLocalDateStr(yd);
  let streak = data.streak || 0;
  let lastDate = data.lastStreakDate || '';
  const badgeDates = data.badgeDates || {};

  if (lastDate === today) return { streak, lastDate, badgeDates };

  const dailyTasks = data.tasks?.filter(t => t.list === 'daily') || [];
  const allDone = dailyTasks.length > 0 && dailyTasks.every(t => t.completed);

  if (allDone) {
    streak = (lastDate === yesterday) ? streak + 1 : 1;
    lastDate = today;
    for (const b of getAllBadges()) {
      if (streak >= b.days && !badgeDates[b.days]) badgeDates[b.days] = today;
    }
  } else {
    if (lastDate !== yesterday && lastDate !== today && lastDate !== '') streak = 0;
  }
  return { streak, lastDate, badgeDates };
}

export function getAllBadges() {
  return [
    { days: 3, name: 'Bronz', icon: '🥉', desc: '3 gün seri' },
    { days: 7, name: 'Gümüş', icon: '🥈', desc: '7 gün seri' },
    { days: 15, name: 'Altın', icon: '🥇', desc: '15 gün seri' },
    { days: 30, name: 'Elmas', icon: '💎', desc: '30 gün seri' },
    { days: 100, name: 'Focus Master', icon: '👑', desc: '100 gün seri' },
  ];
}

export function getCurrentBadge(streak) {
  let current = null;
  for (const b of getAllBadges()) { if (streak >= b.days) current = b; }
  return current;
}

/* ---- XP & Level System ---- */

export const LEVELS = [
  { level: 1, xp: 0, title: 'Çaylak', icon: '🌱' },
  { level: 2, xp: 100, title: 'Başlangıç', icon: '📗' },
  { level: 3, xp: 300, title: 'Azimli', icon: '📘' },
  { level: 4, xp: 600, title: 'Odaklı', icon: '⚡' },
  { level: 5, xp: 1000, title: 'Çalışkan', icon: '🔥' },
  { level: 6, xp: 1800, title: 'Disiplinli', icon: '💪' },
  { level: 7, xp: 3000, title: 'Uzman', icon: '🎯' },
  { level: 8, xp: 5000, title: 'Usta', icon: '🏆' },
  { level: 9, xp: 8000, title: 'Elmas', icon: '💎' },
  { level: 10, xp: 12000, title: 'Efsane', icon: '👑' },
];

export function getLevelInfo(xp) {
  let current = LEVELS[0];
  let next = LEVELS[1];
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].xp) {
      current = LEVELS[i];
      next = LEVELS[i + 1] || null;
      break;
    }
  }
  const xpInLevel = xp - current.xp;
  const xpNeeded = next ? next.xp - current.xp : 0;
  const progress = next ? Math.min(100, Math.round((xpInLevel / xpNeeded) * 100)) : 100;
  return { ...current, xp: xp, xpInLevel, xpNeeded, progress, next };
}

export function getXPForPriority(priority) {
  switch (priority) {
    case 'low': return 10;
    case 'medium': return 20;
    case 'high': return 35;
    default: return 15;
  }
}

/* ---- Achievement System ---- */

export const ALL_ACHIEVEMENTS = [
  { id: 'first_task', icon: '🎯', name: 'İlk Adım', desc: 'İlk görevi tamamla', xp: 10, check: s => s.totalTasksCompleted >= 1 },
  { id: 'task_10', icon: '✅', name: 'Görev Avcısı', desc: '10 görev tamamla', xp: 25, check: s => s.totalTasksCompleted >= 10 },
  { id: 'task_50', icon: '⚡', name: 'Hız Canavarı', desc: '50 görev tamamla', xp: 50, check: s => s.totalTasksCompleted >= 50 },
  { id: 'task_100', icon: '💯', name: 'Yüz Puan', desc: '100 görev tamamla', xp: 100, check: s => s.totalTasksCompleted >= 100 },
  { id: 'pomo_5', icon: '🍅', name: 'Pomodoro Başlangıç', desc: '5 Pomodoro oturumu', xp: 15, check: s => s.pomodoroSessions >= 5 },
  { id: 'pomo_50', icon: '🍅', name: 'Pomodoro Ustası', desc: '50 Pomodoro oturumu', xp: 50, check: s => s.pomodoroSessions >= 50 },
  { id: 'xp_1000', icon: '📈', name: 'XP Koleksiyoncusu', desc: '1000 XP\'ye ulaş', xp: 50, check: s => s.xp >= 1000 },
  { id: 'xp_5000', icon: '👑', name: 'Elit', desc: '5000 XP\'ye ulaş', xp: 100, check: s => s.xp >= 5000 },
  { id: 'streak_7', icon: '🔥', name: 'Haftalık Seri', desc: '7 gün seri', xp: 30, check: s => s.streak >= 7 },
  { id: 'streak_30', icon: '💎', name: 'Aylık Seri', desc: '30 gün seri', xp: 75, check: s => s.streak >= 30 },
];

export function checkAchievements(state) {
  const earned = state.achievements || {};
  const newlyEarned = [];
  const today = toLocalDateStr(new Date());
  for (const a of ALL_ACHIEVEMENTS) {
    if (!earned[a.id] && a.check(state)) {
      newlyEarned.push(a);
      earned[a.id] = today;
    }
  }
  return { earned, newlyEarned };
}

/* ---- Daily Challenge System ---- */

const CHALLENGE_POOL = [
  { id: 'complete_3', title: '3 görev tamamla', target: 3, type: 'tasks', xp: 30, icon: '✅' },
  { id: 'complete_5', title: '5 görev tamamla', target: 5, type: 'tasks', xp: 50, icon: '🎯' },
  { id: 'pomo_1', title: '1 Pomodoro oturumu bitir', target: 1, type: 'pomodoro', xp: 20, icon: '🍅' },
  { id: 'pomo_2', title: '2 Pomodoro oturumu bitir', target: 2, type: 'pomodoro', xp: 35, icon: '🍅' },
  { id: 'habit_1', title: 'Bir alışkanlık işaretle', target: 1, type: 'habits', xp: 15, icon: '🧘' },
  { id: 'all_daily', title: 'Tüm günlük görevleri bitir', target: 1, type: 'all_daily', xp: 50, icon: '🏆' },
  { id: 'add_3', title: '3 yeni görev ekle', target: 3, type: 'add_tasks', xp: 15, icon: '📝' },
];

export function generateDailyChallenges(existingDate) {
  const today = toLocalDateStr(new Date());
  if (existingDate === today) return null; // Already generated for today
  // Pick 3 random unique challenges
  const shuffled = [...CHALLENGE_POOL].sort(() => Math.random() - 0.5);
  const picked = shuffled.slice(0, 3).map(c => ({ ...c, current: 0, done: false }));
  return { date: today, items: picked };
}

export function shouldCreateRecurrence(task, today) {
  if (!task.recurrence || task.recurrence === 'none') return false;
  const last = task.lastRecurrenceDate || '';
  if (last === today) return false;

  const d = new Date(today + 'T00:00:00');
  const dayOfWeek = d.getDay(); // 0=Sun

  switch (task.recurrence) {
    case 'daily': return true;
    case 'weekdays': return dayOfWeek >= 1 && dayOfWeek <= 5;
    case 'weekly': {
      if (!last) return true;
      const lastD = new Date(last + 'T00:00:00');
      const diff = Math.floor((d - lastD) / (1000 * 60 * 60 * 24));
      return diff >= 7;
    }
    default: return false;
  }
}

export function getMotivationalQuote() {
  const quotes = [
    'Sadece başla, gerisi gelecek. 🚀',
    'Odaklan, çalış ve başar! 💪',
    'Küçük adımlar büyük sonuçlar doğurur. 🌱',
    'Bugün yapabildiğini yarına bırakma. ⚡',
    'Disiplin özgürlüğe giden yoldur. 🎯',
    'Başarı her gün tekrarlanan küçük çabaların toplamıdır. 🏆',
    'Hayal et, planla, hayata geçir. ✨',
    'Her usta bir zamanlar amatördü. 📈',
    'Yolculuk bin adımla başlar. 👣',
    'Bugün dünden daha iyi ol. 🌟',
    'Yapamıyorum deme, henüz öğrenmedim de. 🧠',
    'Motivasyon seni başlatır, disiplin seni bitirir. 🔥',
    'Konfor alanın dışında büyüme başlar. 🦅',
    'Şimdi acı çek, sonra şampiyon ol. 🥇',
    'Hedefine odaklan, gürültüyü kapat. 🎧',
    'Bugünün emeği, yarının özgürlüğüdür. 🗝️',
    'Başarısızlık yok, sadece ders var. 📖',
    'En iyi yatırım kendine yaptığındır. 💎',
    'Düştüğün yerden değil, bıraktığın yerden kalk. 🏔️',
    'Zaman geçiyor — verimli kullan. ⏳',
    'İmkansız denen şey, biraz daha uzun sürer. 🔓',
    'Rekabet başkalarıyla değil, dünkü seninle. ⚔️',
    'Azim demir dağları deler. 🛠️',
    'Planlamak, başarının yarısıdır. 📐',
    'Bir adım at — geri kalanı düşünme. 🪜',
    'Zorluklardan güçlenerek çık. 💎',
    'Büyük işler küçük başlangıçlardan doğar. 🌊',
    'Odak, sıradan insanı olağanüstü yapar. ⚡',
    'Tembellik için yarın var, sen bugün başla. 🔔',
    'Bilgi güçtür — öğrenmeye devam et. 📚',
    'Her gün %1 daha iyi = yılda 37 kat büyüme. 📊',
    'Hayallerin büyüklüğü cesaretinle ölçülür. 🦁',
    'Tutarlılık yeteneği yener. 🎯',
    'Bitmedi — sadece zor bir bölümdesin. 🎮',
    'Kendine inan, çünkü bunu hak ediyorsun. 🌈',
    'Erteleme düşmanın, aksiyon dostundur. ⚡',
    'Her saniye bir fırsat — kaçırma. 🎯',
    'Güçlü ol — hem zihinsel hem fiziksel. 🏋️',
    'Bugün ektiğini yarın biçersin. 🌾',
    'Sınırlarını zorlayan sen, gerçek sensin. 🚀',
  ];
  return quotes[Math.floor(Math.random() * quotes.length)];
}

export const CATEGORY_ICONS = [
  '💻', '🏃', '📚', '📌', '🎨', '🎵', '🍳', '✈️', '💼', '🏠',
  '❤️', '🧠', '📱', '🎬', '📖', '💰', '🌿', '🎮', '🏋️', '🛒',
];

export const CATEGORY_COLORS = [
  '#38bdf8', '#fb923c', '#a78bfa', '#64748b', '#f87171',
  '#34d399', '#fbbf24', '#ec4899', '#14b8a6', '#8b5cf6',
];

export const PRIORITIES = [
  { id: 'low', label: 'Kolay', cssClass: 'priority-low' },
  { id: 'medium', label: 'Orta', cssClass: 'priority-medium' },
  { id: 'high', label: 'Zor', cssClass: 'priority-high' },
];

export function sortTasks(tasks, sortBy = 'default') {
  const copy = [...tasks];
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  switch (sortBy) {
    case 'priority':
      copy.sort((a, b) => (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1));
      break;
    case 'date':
      copy.sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate) - new Date(b.dueDate);
      });
      break;
    case 'category':
      copy.sort((a, b) => (a.category || '').localeCompare(b.category || ''));
      break;
    case 'name':
      copy.sort((a, b) => a.title.localeCompare(b.title, 'tr'));
      break;
    default:
      // Default: urgent first, then incomplete first, then newest
      copy.sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        // Urgency: tasks with near due dates first
        const urgA = getUrgencyScore(a.dueDate);
        const urgB = getUrgencyScore(b.dueDate);
        if (urgA !== urgB) return urgB - urgA;
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
  }
  return copy;
}

function getUrgencyScore(dateStr) {
  if (!dateStr) return 0;
  const level = getUrgencyLevel(dateStr);
  switch (level) {
    case 'critical': return 4;
    case 'high': return 3;
    case 'medium': return 2;
    case 'low': return 1;
    default: return 0;
  }
}

export function filterTasks(tasks, filters = {}) {
  let result = [...tasks];
  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(t => t.title.toLowerCase().includes(q));
  }
  if (filters.category && filters.category !== 'all') {
    result = result.filter(t => t.category === filters.category);
  }
  if (filters.priority && filters.priority !== 'all') {
    result = result.filter(t => t.priority === filters.priority);
  }
  if (filters.status === 'active') result = result.filter(t => !t.completed);
  else if (filters.status === 'completed') result = result.filter(t => t.completed);
  return result;
}

export function getCategoryStats(tasks, categories) {
  const stats = {};
  for (const cat of categories) {
    const catTasks = tasks.filter(t => t.category === cat.id);
    const total = catTasks.length;
    const done = catTasks.filter(t => t.completed).length;
    stats[cat.id] = {
      total, done,
      percent: total > 0 ? Math.round((done / total) * 100) : 0,
      color: cat.color,
      icon: cat.icon,
      label: cat.label,
    };
  }
  return stats;
}
