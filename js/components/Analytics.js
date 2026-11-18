import store from '../store.js';
import { icon } from '../utils/icons.js';
import { getCategoryStats, calculateProgress, getAllBadges, getLevelInfo, ALL_ACHIEVEMENTS, isOverdue, toLocalDateStr } from '../utils/helpers.js';
import { showWeeklyReport } from './WeeklyReport.js';

/* Yardımcılar */

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Eski kayıtlardaki XP açıklamaları emojiyle başlar: emojiyi at, kırp, sonra HTML için kaçır. */
export function cleanReason(reason) {
  const plain = String(reason ?? '').replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '').trim();
  return escapeHtml(plain);
}

/** Kategori rengi kullanıcı verisidir; style içine yalnızca düz renk değerleri girer. */
function safeColor(color) {
  const c = String(color || '').trim();
  return /^#[0-9a-f]{3,8}$/i.test(c) || /^(rgb|hsl)a?\([\d\s.,%]+\)$/i.test(c) ? c : 'var(--text-muted)';
}

function formatDay(dateStr) {
  if (!dateStr) return '';
  const d = new Date(String(dateStr).length === 10 ? `${dateStr}T00:00:00` : dateStr);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatLogTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const today = toLocalDateStr(new Date());
  const time = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  if (toLocalDateStr(d) === today) return time;
  return `${d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })} ${time}`;
}

function currentWeekStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return toLocalDateStr(d);
}

function statTile(iconName, value, label, extraClass = '') {
  return `
    <div class="card stat an-stat ${extraClass}">
      <span class="an-stat-icon">${icon(iconName, 16)}</span>
      <span class="stat-value">${value}</span>
      <span class="stat-label">${label}</span>
    </div>`;
}

function progressBar(percent, label) {
  const p = Math.max(0, Math.min(100, Number(percent) || 0));
  return `<div class="an-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p}" aria-label="${escapeHtml(label)}"><div class="an-bar-fill" style="width:${p}%"></div></div>`;
}

/* Analiz */

export function renderAnalytics(container) {
  const allTasks = store.tasks || [];
  const dailyTasks = store.getTasksByList('daily');
  const totalDone = allTasks.filter(t => t.completed).length;
  const overdueCount = allTasks.filter(t => !t.completed && isOverdue(t.dueDate)).length;
  const categories = store.categories || [];
  const categoryStats = getCategoryStats(allTasks, categories);
  const dailyProgress = calculateProgress(dailyTasks);
  const overallProgress = calculateProgress(allTasks);

  const ws = store.weeklyStats || {};
  const thisWeek = ws.weekStart === currentWeekStart() ? ws : {};
  const lastWeek = store.state.lastWeeklyStats;
  const hasLastWeek = !!(lastWeek && lastWeek.weekStart);

  const catRows = categories
    .map(cat => ({ cat, stat: categoryStats[cat.id] }))
    .filter(({ stat }) => stat && stat.total > 0);

  container.innerHTML = `
    <div class="an-page">
      <div class="an-stat-grid">
        ${statTile('list', allTasks.length, 'Toplam görev')}
        ${statTile('check', totalDone, 'Tamamlanan')}
        ${statTile('sun', `%${dailyProgress}`, 'Bugünün ilerlemesi')}
        ${statTile('alert', overdueCount, 'Gecikmiş', overdueCount > 0 ? 'is-warning' : '')}
        ${statTile('flame', store.streak || 0, 'Günlük seri')}
        ${statTile('timer', store.pomodoroSessions || 0, 'Pomodoro oturumu')}
      </div>

      ${allTasks.length === 0 ? `
        <div class="card an-empty">
          <div class="empty-state">
            ${icon('chart', 32)}
            <span>Henüz analiz edilecek görev yok.</span>
            <span class="section-hint">Görev ekleyip tamamladıkça ilerlemen burada görünür.</span>
          </div>
        </div>
      ` : `
        <section class="an-section">
          <div class="an-section-head">
            <h3 class="section-title">Genel ilerleme</h3>
            <span class="section-hint">${totalDone} / ${allTasks.length} görev tamamlandı</span>
          </div>
          <div class="card an-overall">
            <div class="an-row-head">
              <span>Tüm görevler</span>
              <span class="an-row-value">%${overallProgress}</span>
            </div>
            ${progressBar(overallProgress, 'Tüm görevlerin tamamlanma oranı')}
            <div class="an-row-head">
              <span>Bugün</span>
              <span class="an-row-value">%${dailyProgress}</span>
            </div>
            ${progressBar(dailyProgress, 'Bugünün tamamlanma oranı')}
          </div>
        </section>

        <section class="an-section">
          <div class="an-section-head">
            <h3 class="section-title">Kategoriler</h3>
            <span class="section-hint">Kategori başına tamamlanma oranı</span>
          </div>
          ${catRows.length ? `
            <div class="card an-cat-list">
              ${catRows.map(({ cat, stat }) => `
                <div class="an-cat-row">
                  <div class="an-row-head">
                    <span class="an-cat-name"><span class="an-cat-dot" style="background:${safeColor(cat.color)}"></span>${escapeHtml(cat.label)}</span>
                    <span class="an-row-value">${stat.done} / ${stat.total} · %${stat.percent}</span>
                  </div>
                  ${progressBar(stat.percent, `${cat.label} tamamlanma oranı`)}
                </div>
              `).join('')}
            </div>
          ` : `
            <div class="card"><div class="empty-state">${icon('tag', 28)}<span>Kategorisi olan görev yok.</span></div></div>
          `}
        </section>
      `}

      <section class="an-section">
        <div class="an-section-head">
          <h3 class="section-title">Bu hafta</h3>
          <span class="section-hint">Pazartesiden bu yana</span>
        </div>
        <div class="card an-week">
          <div class="an-week-stats">
            <div class="stat"><span class="stat-value">${thisWeek.tasksCompleted || 0}</span><span class="stat-label">Görev</span></div>
            <div class="stat"><span class="stat-value">${thisWeek.xpEarned || 0}</span><span class="stat-label">XP</span></div>
            <div class="stat"><span class="stat-value">${thisWeek.pomodoroCount || 0}</span><span class="stat-label">Pomodoro</span></div>
            <div class="stat"><span class="stat-value">${thisWeek.challengesCompleted || 0}</span><span class="stat-label">Günlük hedef</span></div>
          </div>
          <div class="an-week-action">
            <span class="section-hint">${hasLastWeek ? 'Geçen haftanın özeti her pazartesi otomatik açılır.' : 'Geçen haftaya ait kayıt yok; rapor bu haftayı gösterir.'}</span>
            <button class="btn" id="show-weekly-report-btn">${icon('calendar-check', 16)}Haftalık raporu göster</button>
          </div>
        </div>
      </section>

      <section class="an-section">
        <div class="an-section-head">
          <h3 class="section-title">Veriler</h3>
          <span class="section-hint">Yedek al veya bir yedeği geri yükle</span>
        </div>
        <div class="card an-data">
          <div class="an-data-row">
            <div class="an-data-text">
              <span class="an-data-title">Verileri dışa aktar</span>
              <span class="section-hint">Görevlerini, alışkanlıklarını ve ilerlemeni bir JSON yedek dosyası olarak indirir.</span>
            </div>
            <button class="btn" id="export-data-btn">${icon('download', 16)}Dışa aktar</button>
          </div>
          <div class="an-data-row">
            <div class="an-data-text">
              <span class="an-data-title">Yedekten geri yükle</span>
              <span class="section-hint">Seçtiğin yedek dosyası mevcut tüm verilerin yerine geçer. Bu işlem geri alınamaz.</span>
            </div>
            <button class="btn btn-danger" id="import-data-btn">${icon('upload', 16)}Geri yükle</button>
          </div>
        </div>
      </section>
    </div>
  `;

  container.querySelector('#show-weekly-report-btn')?.addEventListener('click', () => {
    showWeeklyReport(hasLastWeek ? lastWeek : null);
  });

  container.querySelector('#export-data-btn')?.addEventListener('click', () => store.exportData());

  container.querySelector('#import-data-btn')?.addEventListener('click', () => {
    const ok = confirm('Yedek dosyasındaki veriler mevcut tüm verilerinin yerine geçecek. Bu işlem geri alınamaz.\n\nDevam etmek istiyor musun?');
    if (!ok) return;
    store.importData()
      .then(() => {
        alert('Veriler geri yüklendi.');
        window.location.reload();
      })
      .catch(err => alert('Geri yükleme başarısız: ' + err));
  });
}

/* Koleksiyon */

function badgeCard({ iconName, name, desc, earned, meta }) {
  return `
    <div class="card an-badge ${earned ? 'is-earned' : 'is-locked'}">
      <span class="an-badge-icon">${icon(iconName, 22) || icon('award', 22)}</span>
      <div class="an-badge-body">
        <span class="an-badge-name">${escapeHtml(name)}</span>
        <span class="an-badge-desc">${escapeHtml(desc)}</span>
        <span class="an-badge-meta">${earned ? meta : `${icon('lock', 12)}Kilitli`}</span>
      </div>
    </div>`;
}

export function renderBadges(container) {
  const badges = getAllBadges();
  const streak = store.streak || 0;
  const badgeDates = store.badgeDates || {};
  const levelInfo = getLevelInfo(store.xp || 0);
  const xpLog = store.xpLog || [];
  const earnedAch = store.achievements || {};
  const achCount = ALL_ACHIEVEMENTS.filter(a => earnedAch[a.id]).length;
  const streakCount = badges.filter(b => streak >= b.days).length;
  const toNext = levelInfo.next ? levelInfo.next.xp - (store.xp || 0) : 0;

  container.innerHTML = `
    <div class="an-page">
      <div class="card an-level">
        <div class="an-level-top">
          <span class="an-level-icon">${icon(levelInfo.icon, 24) || icon('award', 24)}</span>
          <div class="an-level-info">
            <span class="an-level-title">Seviye ${levelInfo.level} · ${escapeHtml(levelInfo.title)}</span>
            <span class="section-hint">Toplam ${store.xp || 0} XP</span>
          </div>
        </div>
        ${progressBar(levelInfo.progress, 'Sonraki seviyeye ilerleme')}
        <div class="an-level-foot">
          ${levelInfo.next
            ? `<span>${levelInfo.xpInLevel} / ${levelInfo.xpNeeded} XP</span>
               <span>Sonraki seviyeye ${toNext} XP · ${escapeHtml(levelInfo.next.title)}</span>`
            : `<span>En yüksek seviyedesin</span>`}
        </div>
      </div>

      <section class="an-section">
        <div class="an-section-head">
          <h3 class="section-title">Son XP hareketleri</h3>
          <span class="section-hint">Son 10 kayıt</span>
        </div>
        ${xpLog.length ? `
          <div class="card an-log">
            ${xpLog.slice(0, 10).map(entry => {
              const gain = entry.amount > 0;
              return `
                <div class="an-log-row ${gain ? 'is-gain' : 'is-loss'}">
                  <span class="an-log-amount">${gain ? '+' : ''}${Number(entry.amount) || 0}</span>
                  <span class="an-log-reason">${cleanReason(entry.reason)}</span>
                  <span class="an-log-time">${formatLogTime(entry.date)}</span>
                </div>`;
            }).join('')}
          </div>
        ` : `
          <div class="card"><div class="empty-state">${icon('bolt', 28)}<span>Henüz XP kazanmadın.</span><span class="section-hint">Görev, alışkanlık ve Pomodoro tamamladıkça kayıtlar burada görünür.</span></div></div>
        `}
      </section>

      <section class="an-section">
        <div class="an-section-head">
          <h3 class="section-title">Başarımlar</h3>
          <span class="section-hint">${achCount} / ${ALL_ACHIEVEMENTS.length} açıldı</span>
        </div>
        <div class="an-badge-grid">
          ${ALL_ACHIEVEMENTS.map(a => {
            const date = earnedAch[a.id];
            return badgeCard({
              iconName: a.icon,
              name: a.name,
              desc: a.desc,
              earned: !!date,
              meta: `+${a.xp} XP${formatDay(date) ? ` · ${formatDay(date)}` : ''}`,
            });
          }).join('')}
        </div>
      </section>

      <section class="an-section">
        <div class="an-section-head">
          <h3 class="section-title">Seri rozetleri</h3>
          <span class="section-hint">Şu anki seri: ${streak} gün · ${streakCount} / ${badges.length} açıldı</span>
        </div>
        <div class="an-badge-grid">
          ${badges.map(b => badgeCard({
            iconName: b.icon,
            name: b.name,
            desc: b.desc,
            earned: streak >= b.days,
            meta: formatDay(badgeDates[b.days]) || 'Açıldı',
          })).join('')}
        </div>
      </section>
    </div>
  `;
}
