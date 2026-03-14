import { requireAuth, logout } from "../firebase/auth-guard.js";
import { db } from "../firebase/firebase-config.js";
import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  loadActivities,
  addActivity,
  activityCodeExists
} from "../firebase/firestore-service.js";

(async function () {
  'use strict';

  const profile = await requireAuth();
  Utils.initSidebarUser();

  document.getElementById('logout-btn')?.addEventListener('click', logout);

  const formCard = document.getElementById('activities-form-card');
  const addBtn = document.getElementById('add-activity-btn');
  const clearBtn = document.getElementById('clear-activity-btn');
  const committeeHeadCell = document.getElementById('committee-head-cell');

  if (profile.role === 'manager') {
    if (formCard) formCard.style.display = 'none';
    if (committeeHeadCell) committeeHeadCell.style.display = '';
  } else {
    addBtn?.addEventListener('click', addActivityHandler);
    clearBtn?.addEventListener('click', clearForm);
  }

  await renderTable();

  async function addActivityHandler() {
    const name = Utils.val('a-name');
    const activityCode = Utils.val('a-id');
    const pointsValue = Utils.val('a-pts');

    const controls = ['a-name', 'a-id', 'a-pts'];
    Utils.clearErrors(controls);

    let valid = true;
    if (!name) { Utils.showFieldError('a-name', 'err-a-name'); valid = false; }
    if (!activityCode) { Utils.showFieldError('a-id', 'err-a-id'); valid = false; }
    if (!pointsValue) { Utils.showFieldError('a-pts', 'err-a-pts'); valid = false; }
    if (!valid) return;

    const points = Number(pointsValue);
    if (!Number.isFinite(points) || points < 0) {
      Utils.showAlert('activity-form-alert', 'error', '⚠️ Please enter a valid point value.');
      document.getElementById('a-pts')?.classList.add('error');
      return;
    }

    const committeeId = profile.committeeId;

    const exists = await activityCodeExists(committeeId, activityCode);
    if (exists) {
      Utils.showAlert('activity-form-alert', 'error', '⚠️ An activity with this ID already exists in this committee.');
      document.getElementById('a-id')?.classList.add('error');
      return;
    }

    await addActivity(
      committeeId,
      {
        name,
        activityCode,
        points
      },
      profile.uid
    );

    await renderTable();
    clearForm();
    Utils.showAlert('activity-form-alert', 'success', '✅ Activity created successfully!');
    Utils.toast('Activity created', 'success');
  }

  async function renderTable() {
    const tbody = document.getElementById('activities-tbody');
    const countEl = document.getElementById('activities-count-label');

    const committeeId = profile.role === 'manager' ? null : profile.committeeId;

    const [activities, committeesMap] = await Promise.all([
      loadActivities(committeeId),
      loadCommitteesMap()
    ]);

    if (countEl) {
      countEl.textContent = `${activities.length} activit${activities.length !== 1 ? 'ies' : 'y'}`;
    }

    if (!tbody) return;

    const colspan = profile.role === 'manager' ? 5 : 4;

    if (!activities.length) {
      tbody.innerHTML = `<tr><td colspan="${colspan}">${emptyState('⚡', 'No activities created yet')}</td></tr>`;
      return;
    }

    tbody.innerHTML = activities.map((a, i) => {
      const committeeCell = profile.role === 'manager'
        ? `<td><span class="badge badge-green">${escapeHtml(committeesMap[a.committeeId] || a.committeeId || '-')}</span></td>`
        : '';

      return `
        <tr>
          <td class="row-index">${i + 1}</td>
          <td><strong>${escapeHtml(a.name || '')}</strong></td>
          <td><code style="background:rgba(255,255,255,.06);padding:2px 8px;border-radius:5px;font-size:12px">${escapeHtml(a.activityCode || '')}</code></td>
          ${committeeCell}
          <td><span class="pts-pill">${Number(a.points || 0)} pts</span></td>
        </tr>
      `;
    }).join('');
  }

  async function loadCommitteesMap() {
    const snap = await getDocs(collection(db, "committees"));
    const map = {};
    snap.forEach(doc => {
      const data = doc.data();
      map[data.committeeId || doc.id] = data.name || data.committeeId || doc.id;
    });
    return map;
  }

  function clearForm() {
    Utils.resetFields(['a-name', 'a-id', 'a-pts']);
    Utils.clearErrors(['a-name', 'a-id', 'a-pts']);
  }

  function emptyState(emoji, text) {
    return `<div class="empty-state"><div class="emoji">${emoji}</div><p>${text}</p></div>`;
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