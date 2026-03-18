import { requireAuth, logout } from "../firebase1/auth-guard.js";
import { loadLeaderboard, loadCommitteesMap } from "../firebase1/firestore-service.js";

(async function () {
  'use strict';

  // ── Show skeleton immediately ─────────────────────────────────────────────
  const container = document.getElementById('leaderboard-list');
  if (container) {
    container.innerHTML = Array(6).fill(0).map(() => `
      <div class="leaderboard-item" style="opacity:0.4;pointer-events:none">
        <div class="rank rank-other"><div class="skeleton-line" style="width:24px;height:24px;border-radius:50%"></div></div>
        <div class="lb-info">
          <div class="skeleton-line" style="width:140px;height:14px;margin-bottom:6px"></div>
          <div class="skeleton-line" style="width:200px;height:10px"></div>
        </div>
        <div class="lb-pts-col">
          <div class="skeleton-line" style="width:60px;height:20px"></div>
        </div>
      </div>`).join('');
  }

  const profile = await requireAuth();
  Utils.initSidebarUser();

  document.getElementById('logout-btn')?.addEventListener('click', logout);

  await renderLeaderboard();

  async function renderLeaderboard() {
    if (!container) return;

    const committeeId = profile.role === 'manager' ? null : profile.committeeId;

    let list, committeesMap;
    try {
      // Both calls hit sessionStorage cache after the first page load in the session.
      [list, committeesMap] = await Promise.all([
        loadLeaderboard(committeeId),
        loadCommitteesMap()
      ]);
    } catch (err) {
      console.error('Failed to load leaderboard:', err);
      container.innerHTML = Utils.emptyState('⚠️', 'Failed to load leaderboard. Please refresh.');
      return;
    }

    if (!list.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="emoji">🏆</div>
          <p>No data yet. Add students and assign activities to see the leaderboard.</p>
        </div>`;
      return;
    }

    const uniquePoints = [...new Set(list.map(s => Number(s.totalPoints || 0)))].sort((a, b) => b - a);
    const maxPts = uniquePoints[0] || 1;
    const medals = ['🥇', '🥈', '🥉'];

    container.innerHTML = list.map((s) => {
      const sPts = Number(s.totalPoints || 0);
      const actualRank = uniquePoints.indexOf(sPts) + 1;

      const rankClass =
        actualRank === 1 ? 'rank-1' :
        actualRank === 2 ? 'rank-2' :
        actualRank === 3 ? 'rank-3' : 'rank-other';

      const rankLabel = actualRank <= 3 ? medals[actualRank - 1] : actualRank;
      const pct = Math.round((sPts / maxPts) * 100);
      const assignmentCount = Number(s.assignmentCount || 0);

      const committeeLine = profile.role === 'manager'
        ? `<div class="lb-committee" style="font-size:12px;color:rgba(232,232,234,.55);margin-top:2px">
              🏢 ${Utils.escapeHtml(committeesMap[s.committeeId] || s.committeeId || '-')}
           </div>`
        : '';

      return `
        <div class="leaderboard-item">
          <div class="rank ${rankClass}">${rankLabel}</div>
          <div class="lb-info">
            <div class="lb-name">${Utils.escapeHtml(s.fullName || '')}</div>
            <div class="lb-meta">${Utils.escapeHtml(s.major || '')} · ${Utils.escapeHtml(s.level || '')} · ${Utils.escapeHtml(s.gender || '')}</div>
            ${committeeLine}
            <div class="lb-progress progress-wrap">
              <div class="progress-bar ${actualRank === 1 ? '' : 'sky'}" style="width:${pct}%"></div>
            </div>
          </div>
          <div class="lb-pts-col">
            <div class="lb-pts">${sPts}<small> pts</small></div>
            <div class="lb-asgn-count">${assignmentCount} assignment${assignmentCount !== 1 ? 's' : ''}</div>
          </div>
        </div>`;
    }).join('');
  }
})();