import { requireAuth, logout } from "../firebase/auth-guard.js";
import {
  loadMembers,
  loadActivities,
  loadAssignments,
  addAssignment
} from "../firebase/firestore-service.js";

(async function () {
  'use strict';

  const profile = await requireAuth();
  Utils.initSidebarUser();

  document.getElementById('logout-btn')?.addEventListener('click', logout);
  document.getElementById('save-assignment-btn')?.addEventListener('click', addAssignmentHandler);
  document.getElementById('clear-assignment-btn')?.addEventListener('click', clearForm);

  await populateDropdowns();
  await renderTable();

  async function populateDropdowns() {
    const studentSel = document.getElementById('asgn-student');
    const activitySel = document.getElementById('asgn-activity');

    if (!studentSel || !activitySel) return;

    const currentStudent = studentSel.value;
    const currentActivity = activitySel.value;

    const committeeId = profile.role === 'manager' ? null : profile.committeeId;

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

    const committeeId = profile.role === 'manager' ? null : profile.committeeId;

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

    const finalCommitteeId = profile.role === 'manager'
      ? (selectedMember.committeeId || selectedActivity.committeeId || 'committee1')
      : profile.committeeId;

    await addAssignment(
      finalCommitteeId,
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
    Utils.showAlert('assign-form-alert', 'success', '✅ Assignment saved successfully!');
    Utils.toast('Assignment saved', 'success');
  }

  async function renderTable() {
    const tbody = document.getElementById('assignments-tbody');
    const countEl = document.getElementById('assignments-count-label');

    const committeeId = profile.role === 'manager' ? null : profile.committeeId;
    const assignments = await loadAssignments(committeeId);

    if (countEl) {
      countEl.textContent = `${assignments.length} record${assignments.length !== 1 ? 's' : ''}`;
    }

    if (!tbody) return;

    if (!assignments.length) {
      tbody.innerHTML = `<tr><td colspan="6">${emptyState('📋', 'No assignments recorded yet')}</td></tr>`;
      return;
    }

    tbody.innerHTML = assignments.map((a, i) => {
      const dateText = formatDate(a.assignedAt || a.createdAt || null);

      return `
        <tr>
          <td class="row-index">${i + 1}</td>
          <td><strong>${escapeHtml(a.memberName || a.studentName || '')}</strong></td>
          <td>${escapeHtml(a.activityName || '')}</td>
          <td><span class="pts-pill">${Number(a.points || 0)} pts</span></td>
          <td style="color:rgba(232,232,234,.55);font-size:12px">${escapeHtml(a.description || a.desc || '—')}</td>
          <td style="color:rgba(232,232,234,.4);font-size:12px">${dateText}</td>
        </tr>
      `;
    }).join('');
  }

  function clearForm() {
    Utils.resetFields(['asgn-student', 'asgn-activity', 'asgn-pts', 'asgn-desc']);
    Utils.clearErrors(['asgn-student', 'asgn-activity']);
  }

  function emptyState(emoji, text) {
    return `<div class="empty-state"><div class="emoji">${emoji}</div><p>${text}</p></div>`;
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

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
})();