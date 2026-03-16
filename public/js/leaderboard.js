import { requireAuth, logout } from "../firebase1/auth-guard.js";
import { database } from "../firebase1/firebase-config.js";
import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { loadLeaderboard } from "../firebase1/firestore-service.js";

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

    const [list, committeesMap] = await Promise.all([
      loadLeaderboard(committeeId),
      loadCommitteesMap()
    ]);

    if (!list.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="emoji">🏆</div>
          <p>No data yet. Add students and assign activities to see the leaderboard.</p>
        </div>`;
      return;
    }

//Extract the unique points without duplicates and sort them from largest to smalles
const uniquePoints = [...new Set(list.map(s => Number(s.totalPoints || 0)))].sort((a, b) => b - a);

const maxPts = uniquePoints[0] || 1; 
const medals = ['🥇', '🥈', '🥉'];

container.innerHTML = list.map((s, i) => {
    const sPts = Number(s.totalPoints || 0);
    
     
    const actualRank = uniquePoints.indexOf(sPts) + 1;

    // Select the top class color on the common center
    const rankClass =
        actualRank === 1 ? 'rank-1' :
        actualRank === 2 ? 'rank-2' :
        actualRank === 3 ? 'rank-3' : 'rank-other';

    // Medal awarded based on joint ranking
    const rankLabel = actualRank <= 3 ? medals[actualRank - 1] : actualRank;
    
    const pct = Math.round((sPts / maxPts) * 100);
    const assignmentCount = Number(s.assignmentCount || 0);

    const committeeLine = profile.role === 'manager'
        ? `<div class="lb-committee" style="font-size:12px;color:rgba(232,232,234,.55);margin-top:2px">
              🏢 ${escapeHtml(committeesMap[s.committeeId] || s.committeeId || '-')}
           </div>`
        : '';

    return `
        <div class="leaderboard-item">
          <div class="rank ${rankClass}">${rankLabel}</div>
          <div class="lb-info">
            <div class="lb-name">${escapeHtml(s.fullName || '')}</div>
            <div class="lb-meta">${escapeHtml(s.major || '')} · ${escapeHtml(s.level || '')} · ${escapeHtml(s.gender || '')}</div>
            ${committeeLine}
            <div class="lb-progress progress-wrap">
              <div class="progress-bar ${actualRank === 1 ? '' : 'sky'}" style="width:${pct}%"></div>
            </div>
          </div>
          <div class="lb-pts-col">
            <div class="lb-pts">${sPts}<small> pts</small></div>
            <div class="lb-asgn-count">${assignmentCount} assignment${assignmentCount !== 1 ? 's' : ''}</div>
          </div>
        </div>
    `;
}).join('');
  }

  async function loadCommitteesMap() {
    const snap = await getDocs(collection(database, "committees"));
    const map = {};
    snap.forEach(doc => {
      const data = doc.data();
      map[data.committeeId || doc.id] = data.name || data.committeeId || doc.id;
    });
    return map;
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