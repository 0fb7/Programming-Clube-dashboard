import { requireAuth, logout } from "../firebase/auth-guard.js";
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
  document.getElementById('add-activity-btn')?.addEventListener('click', addActivityHandler);
  document.getElementById('clear-activity-btn')?.addEventListener('click', clearForm);

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

    const committeeId =
      profile.role === 'manager'
        ? (Utils.val('a-committee') || 'committee1')
        : profile.committeeId;

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
    const activities = await loadActivities(committeeId);

    if (countEl) {
      countEl.textContent = `${activities.length} activit${activities.length !== 1 ? 'ies' : 'y'}`;
    }

    if (!tbody) return;

    if (!activities.length) {
      tbody.innerHTML = `<tr><td colspan="4">${emptyState('⚡', 'No activities created yet')}</td></tr>`;
      return;
    }

    tbody.innerHTML = activities.map((a, i) => `
      <tr>
        <td class="row-index">${i + 1}</td>
        <td><strong>${escapeHtml(a.name || '')}</strong></td>
        <td><code style="background:rgba(255,255,255,.06);padding:2px 8px;border-radius:5px;font-size:12px">${escapeHtml(a.activityCode || a.aid || '')}</code></td>
        <td><span class="pts-pill">${Number(a.points || 0)} pts</span></td>
      </tr>
    `).join('');
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