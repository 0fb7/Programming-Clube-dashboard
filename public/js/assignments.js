import { requireAuth, logout } from "../firebase1/auth-guard.js";
import { database } from "../firebase1/firebase-config.js";
import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  loadMembers,
  loadActivities,
  loadAssignments,
  addAssignment,
  deleteAssignment
} from "../firebase1/firestore-service.js";

(async function () {
  'use strict';

  const profile = await requireAuth();
  Utils.initSidebarUser();

  document.getElementById('logout-btn')?.addEventListener('click', logout);

  const formCard = document.getElementById('assignments-form-card');
  const saveBtn = document.getElementById('save-assignment-btn');
  const clearBtn = document.getElementById('clear-assignment-btn');
  const committeeHeadCell = document.getElementById('committee-head-cell');

  const tbody = document.getElementById('assignments-tbody');
  tbody?.addEventListener('click', async (e) => {
    const btn = e.target.closest('.delete-assignment-btn');
    if (!btn) return;

    const assignmentId = btn.dataset.id;
    const memberName = btn.dataset.member || 'this record';
    const activityName = btn.dataset.activity || '';

    const label = activityName ? `${memberName} / ${activityName}` : memberName;
    const ok = confirm(`Are you sure you want to delete ${label}?`);
    if (!ok) return;

    try {
      btn.disabled = true;
      await deleteAssignment(assignmentId);
      await renderTable();
      if (profile.role !== 'manager') {
        await populateDropdowns();
      }
      Utils.toast('Assignment deleted', 'success');
    } catch (error) {
      console.error(error);
      Utils.toast('Failed to delete assignment', 'error');
    }
  });

  if (profile.role === 'manager') {
    if (formCard) formCard.style.display = 'none';
    if (committeeHeadCell) committeeHeadCell.style.display = '';
  } else {
    saveBtn?.addEventListener('click', addAssignmentHandler);
    clearBtn?.addEventListener('click', clearForm);
    await populateDropdowns();
  }

  await renderTable();

  async function populateDropdowns() {
    const studentSel = document.getElementById('asgn-student');
    const activitySel = document.getElementById('asgn-activity');

    if (!studentSel || !activitySel) return;

    const currentStudent = studentSel.value;
    const currentActivity = activitySel.value;

    const committeeId = profile.committeeId;

    const [members, activities] = await Promise.all([
      loadMembers(committeeId),
      loadActivities(committeeId)
    ]);

    studentSel.innerHTML =
      '<option value="">Select student</option>' +
      members.map(m => `
        <option value="${m.id}" ${m.id === currentStudent ? 'selected' : ''}>
          ${escapeHtml(m.fullName || '')}
        </option>
      `).join('');

    activitySel.innerHTML =
      '<option value="">Select activity</option>' +
      activities.map(a => `
        <option value="${a.id}" ${a.id === currentActivity ? 'selected' : ''}>
          ${escapeHtml(a.name || '')} (${Number(a.points || 0)} pts)
        </option>
      `).join('');
  }

  async function addAssignmentHandler() {
    const memberId = Utils.val('asgn-student');
    const activityId = Utils.val('asgn-activity');
    const customPoints = Utils.val('asgn-pts');
    const description = Utils.val('asgn-desc');

    Utils.clearErrors(['asgn-student', 'asgn-activity']);

    let valid = true;
    if (!memberId) { Utils.showFieldError('asgn-student', 'err-asgn-student'); valid = false; }
    if (!activityId) { Utils.showFieldError('asgn-activity', 'err-asgn-activity'); valid = false; }
    if (!valid) return;

    const committeeId = profile.committeeId;

    const [members, activities] = await Promise.all([
      loadMembers(committeeId),
      loadActivities(committeeId)
    ]);

    const selectedMember = members.find(m => m.id === memberId);
    const selectedActivity = activities.find(a => a.id === activityId);

    if (!selectedMember || !selectedActivity) {
      Utils.showAlert('assign-form-alert', 'error', '⚠️ Selected member or activity was not found.');
      return;
    }

    const points = customPoints ? Number(customPoints) : Number(selectedActivity.points || 0);
    if (!Number.isFinite(points) || points < 0) {
      Utils.showAlert('assign-form-alert', 'error', '⚠️ Invalid points value.');
      return;
    }

    await addAssignment(
      committeeId,
      {
        memberId: selectedMember.id,
        memberName: selectedMember.fullName || '',
        activityId: selectedActivity.id,
        activityName: selectedActivity.name || '',
        points,
        description
      },
      profile.uid
    );

    await renderTable();
    clearForm();
    await populateDropdowns();
    Utils.showAlert('assign-form-alert', 'success', '✅ Assignment saved successfully!');
    Utils.toast('Assignment saved', 'success');
  }

  async function renderTable() {
    const tbody = document.getElementById('assignments-tbody');
    const countEl = document.getElementById('assignments-count-label');

    const committeeId = profile.role === 'manager' ? null : profile.committeeId;

    const [assignments, committeesMap] = await Promise.all([
      loadAssignments(committeeId),
      loadCommitteesMap()
    ]);

    if (countEl) {
      countEl.textContent = `${assignments.length} record${assignments.length !== 1 ? 's' : ''}`;
    }

    if (!tbody) return;

    const colspan = 7;

    if (!assignments.length) {
      tbody.innerHTML = `<tr><td colspan="${colspan}">${emptyState('📋', 'No assignments recorded yet')}</td></tr>`;
      return;
    }

    tbody.innerHTML = assignments.map((a, i) => {
  const dateText = formatDate(a.assignedAt || a.createdAt || null);

  const committeeCell = profile.role === 'manager'
    ? `<td><span class="badge badge-green">${escapeHtml(committeesMap[a.committeeId] || a.committeeId || '-')}</span></td>`
    : '';

  const deleteCell = profile.role !== 'manager'
    ? `
      <td style="text-align:center;">
        <button
          class="delete-assignment-btn"
          type="button"
          data-id="${escapeHtml(a.id || '')}"
          data-member="${escapeHtml(a.memberName || 'Record')}"
          data-activity="${escapeHtml(a.activityName || '')}"
          title="Delete assignment"
          aria-label="Delete assignment"
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
          onmouseover="this.style.background='rgba(255,255,255,0.05)';this.style.borderColor='rgba(255,255,255,0.14)'"
          onmouseout="this.style.background='transparent';this.style.borderColor='rgba(255,255,255,0.08)'"
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
      <td><strong>${escapeHtml(a.memberName || '')}</strong></td>
      <td>${escapeHtml(a.activityName || '')}</td>
      ${committeeCell}
      <td><span class="pts-pill">${Number(a.points || 0)} pts</span></td>
      <td style="color:rgba(232,232,234,.55);font-size:12px">${escapeHtml(a.description || '—')}</td>
      <td style="color:rgba(232,232,234,.4);font-size:12px">${dateText}</td>
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
    Utils.resetFields(['asgn-student', 'asgn-activity', 'asgn-pts', 'asgn-desc']);
    Utils.clearErrors(['asgn-student', 'asgn-activity']);
  }

  function formatDate(value) {
    if (!value) return '—';
    try {
      if (typeof value.toDate === 'function') {
        return value.toDate().toLocaleDateString('en-GB');
      }
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('en-GB');
    } catch {
      return '—';
    }
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