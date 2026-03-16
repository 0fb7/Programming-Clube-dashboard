import { requireAuth, logout } from "../firebase1/auth-guard.js";
import { database } from "../firebase1/firebase-config.js";
import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  loadActivities,
  addActivity,
  deleteActivity,
  activityCodeExists
} from "../firebase1/firestore-service.js";

(async function () {
  'use strict';

  const profile = await requireAuth();
  Utils.initSidebarUser();

  document.getElementById('logout-btn')?.addEventListener('click', logout);

  const formCard = document.getElementById('activities-form-card');
  const addBtn = document.getElementById('add-activity-btn');
  const clearBtn = document.getElementById('clear-activity-btn');
  const committeeHeadCell = document.getElementById('committee-head-cell');

  const tbody = document.getElementById('activities-tbody');

tbody?.addEventListener('click', async (e) => {
  const btn = e.target.closest('.delete-activity-btn');
  if (!btn) return;

  const activityId = btn.dataset.id;
  const activityName = btn.dataset.name || 'this activity';

  const ok = confirm(`Are you sure you want to delete ${activityName}?`);
  if (!ok) return;

  try {
    btn.disabled = true;
    await deleteActivity(activityId);
    await renderTable();
    Utils.toast('Activity deleted', 'success');
  } catch (error) {
    console.error(error);
    Utils.toast('Failed to delete activity', 'error');
  } finally {
    btn.disabled = false;
  }
});

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

    const colspan = 5;

    if (!activities.length) {
      tbody.innerHTML = `<tr><td colspan="${colspan}">${emptyState('⚡', 'No activities created yet')}</td></tr>`;
      return;
    }

   tbody.innerHTML = activities.map((a, i) => {
  const committeeCell = profile.role === 'manager'
    ? `<td><span class="badge badge-green">${escapeHtml(committeesMap[a.committeeId] || a.committeeId || '-')}</span></td>`
    : '';

  const deleteCell = profile.role !== 'manager'
    ? `
      <td style="text-align:center;">
        <button
          class="delete-activity-btn"
          type="button"
          data-id="${escapeHtml(a.id || '')}"
          data-name="${escapeHtml(a.name || 'Activity')}"
          title="Delete activity"
          aria-label="Delete activity"
          style="
            width: 34px;
            height: 34px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            background: transparent;
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 10px;
            cursor: pointer;
            transition: 0.2s ease;
          "
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 6h18"/>
            <path d="M8 6V4h8v2"/>
            <path d="M19 6l-1 14H6L5 6"/>
            <path d="M10 11v6"/>
            <path d="M14 11v6"/>
          </svg>
        </button>
      </td>
    `
    : '';

  return `
    <tr>
      <td class="row-index">${i + 1}</td>
      <td><strong>${escapeHtml(a.name || '')}</strong></td>
      <td><code style="background:rgba(255,255,255,.06);padding:2px 8px;border-radius:5px;font-size:12px">${escapeHtml(a.activityCode || '')}</code></td>
      ${committeeCell}
      <td><span class="pts-pill">${Number(a.points || 0)} pts</span></td>
      ${deleteCell}
    </tr>
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