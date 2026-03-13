import { requireAuth, logout } from "../firebase/auth-guard.js";
import { loadLeaderboard } from "../firebase/firestore-service.js";

(async function () {
  'use strict';

  const profile = await requireAuth();
  Utils.initSidebarUser();

  document.getElementById('logout-btn')?.addEventListener('click', logout);

  await renderLeaderboard();

  async function renderLeaderboard() {
    const container = document.getElementById('leaderboard-list');
    if (!container) return;

    const committeeId = profile.role === 'manager' ? null : profile.committeeId;
    const list = await loadLeaderboard(committeeId);

    if (!list.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="emoji">🏆</div>
          <p>No data yet. Add students and assign activities to see the leaderboard.</p>
        </div>`;
      return;
    }

    const maxPts = Number(list[0].totalPoints || 0) || 1;
    const medals = ['🥇', '🥈', '🥉'];

    container.innerHTML = list.map((s, i) => {
      const rankClass =
        i === 0 ? 'rank-1' :
        i === 1 ? 'rank-2' :
        i === 2 ? 'rank-3' : 'rank-other';

      const rankLabel = i < 3 ? medals[i] : i + 1;
      const pct = Math.round((Number(s.totalPoints || 0) / maxPts) * 100);
      const assignmentCount = Number(s.assignmentCount || 0);

      return `
        <div class="leaderboard-item">
          <div class="rank ${rankClass}">${rankLabel}</div>
          <div class="lb-info">
            <div class="lb-name">${escapeHtml(s.fullName || '')}</div>
            <div class="lb-meta">${escapeHtml(s.major || '')} · ${escapeHtml(s.level || '')} · ${escapeHtml(s.gender || '')}</div>
            <div class="lb-progress progress-wrap">
              <div class="progress-bar ${i === 0 ? '' : 'sky'}" style="width:${pct}%"></div>
            </div>
          </div>
          <div class="lb-pts-col">
            <div class="lb-pts">${Number(s.totalPoints || 0)}<small> pts</small></div>
            <div class="lb-asgn-count">${assignmentCount} assignment${assignmentCount !== 1 ? 's' : ''}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
})();