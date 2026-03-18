import { requireAuth, logout } from "../firebase1/auth-guard.js";
import {
  loadMembers,
  loadActivities,
  loadAssignments,
  addAssignment,
  deleteAssignment,
  loadCommitteesMap
} from "../firebase1/firestore-service.js";

(async function () {
  'use strict';

  // ── Show skeleton immediately ─────────────────────────────────────────────
  // FIX: colspan updated to 8.
  // Column layout: #, Student, Activity, [Committee OR Delete], Points, Description, Date
  Utils.showTableSkeleton('assignments-tbody', 8);

  const profile = await requireAuth();
  Utils.initSidebarUser();

  document.getElementById('logout-btn')?.addEventListener('click', logout);

  // ── Module-level state ────────────────────────────────────────────────────
  let cachedMembers    = [];
  let cachedActivities = [];

  // activeCommitteeId: null = all (manager default), or specific id.
  let activeCommitteeId = profile.role === 'manager' ? null : profile.committeeId;

  // ── Delete handler ────────────────────────────────────────────────────────
  const tbody = document.getElementById('assignments-tbody');
  tbody?.addEventListener('click', async (e) => {
    const btn = e.target.closest('.delete-assignment-btn');
    if (!btn) return;

    const assignmentId = btn.dataset.id;
    const memberName   = btn.dataset.member || 'this record';
    const activityName = btn.dataset.activity || '';
    const label        = activityName ? `${memberName} / ${activityName}` : memberName;

    if (!confirm(`Are you sure you want to delete ${label}?`)) return;

    try {
      btn.disabled = true;
      await deleteAssignment(assignmentId, profile.committeeId);
      await renderTable();
      Utils.toast('Assignment deleted', 'success');
    } catch (error) {
      console.error(error);
      Utils.toast('Failed to delete assignment', 'error');
    } finally {
      btn.disabled = false;
    }
  });

  // ── Role-based UI setup ───────────────────────────────────────────────────
  const formCard          = document.getElementById('assignments-form-card');
  const saveBtn           = document.getElementById('save-assignment-btn');
  const clearBtn          = document.getElementById('clear-assignment-btn');
  const committeeHeadCell = document.getElementById('committee-head-cell');
  const deleteHeadCell    = document.getElementById('delete-head-cell');

  if (profile.role === 'manager') {
    if (formCard) formCard.style.display = 'none';
    if (committeeHeadCell) committeeHeadCell.style.display = '';
    if (deleteHeadCell) deleteHeadCell.style.display = 'none';

    await _initManagerFilter();
    await renderTable();
  } else {
    saveBtn?.addEventListener('click', addAssignmentHandler);
    clearBtn?.addEventListener('click', clearForm);

    const committeeId = profile.committeeId;
    const [members, activities] = await Promise.all([
      loadMembers(committeeId),
      loadActivities(committeeId)
    ]);
    cachedMembers    = members;
    cachedActivities = activities;

    populateDropdowns();
    await renderTable();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MANAGER FILTER
  // ═══════════════════════════════════════════════════════════════════════════

  async function _initManagerFilter() {
    const filterCard   = document.getElementById('manager-filter-card');
    const filterSelect = document.getElementById('committee-filter-select');
    if (!filterCard || !filterSelect) return;

    filterCard.style.display = 'block';

    const committeesMap = await loadCommitteesMap();
    const entries = Object.entries(committeesMap);

    if (entries.length) {
      filterSelect.innerHTML =
        '<option value="all">All Committees</option>' +
        entries.map(([id, name]) =>
          `<option value="${Utils.escapeHtml(id)}">${Utils.escapeHtml(name)}</option>`
        ).join('');
    }

    filterSelect.addEventListener('change', Utils.debounce(async () => {
      const val = filterSelect.value;
      activeCommitteeId = val === 'all' ? null : val;
      await renderTable();
    }, 300));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DATA
  // ═══════════════════════════════════════════════════════════════════════════

  function populateDropdowns() {
    const studentSel  = document.getElementById('asgn-student');
    const activitySel = document.getElementById('asgn-activity');
    if (!studentSel || !activitySel) return;

    const currentStudent  = studentSel.value;
    const currentActivity = activitySel.value;

    studentSel.innerHTML =
      '<option value="">Select student</option>' +
      cachedMembers.map(m =>
        `<option value="${m.id}" ${m.id === currentStudent ? 'selected' : ''}>
          ${Utils.escapeHtml(m.fullName || '')}
        </option>`
      ).join('');

    activitySel.innerHTML =
      '<option value="">Select activity</option>' +
      cachedActivities.map(a =>
        `<option value="${a.id}" ${a.id === currentActivity ? 'selected' : ''}>
          ${Utils.escapeHtml(a.name || '')} (${Number(a.points || 0)} pts)
        </option>`
      ).join('');
  }

  async function addAssignmentHandler() {
    const memberId     = Utils.val('asgn-student');
    const activityId   = Utils.val('asgn-activity');
    const customPoints = Utils.val('asgn-pts');
    const description  = Utils.val('asgn-desc');

    Utils.clearErrors(['asgn-student', 'asgn-activity']);

    let valid = true;
    if (!memberId)   { Utils.showFieldError('asgn-student', 'err-asgn-student'); valid = false; }
    if (!activityId) { Utils.showFieldError('asgn-activity', 'err-asgn-activity'); valid = false; }
    if (!valid) return;

    const selectedMember   = cachedMembers.find(m => m.id === memberId);
    const selectedActivity = cachedActivities.find(a => a.id === activityId);

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
      profile.committeeId,
      {
        memberId:     selectedMember.id,
        memberName:   selectedMember.fullName || '',
        activityId:   selectedActivity.id,
        activityName: selectedActivity.name || '',
        points,
        description
      },
      profile.uid
    );

    await Promise.all([
      renderTable(),
      Promise.resolve(populateDropdowns())
    ]);

    clearForm();
    Utils.showAlert('assign-form-alert', 'success', '✅ Assignment saved successfully!');
    Utils.toast('Assignment saved', 'success');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * FIX — Column alignment:
   *   The original assignments.html had NO <th> for the Delete button column.
   *   The JS was already rendering a delete <td> for the head role, which
   *   pushed the Date cell one column to the right — it appeared under
   *   "Description" header visually. The Date was technically being rendered
   *   but was misaligned.
   *
   *   Fix: assignments.html now has <th id="delete-head-cell">Action</th>.
   *   The JS produces exactly 7 fixed cells + 1 conditional = 8 total,
   *   matching the 8 <th> in the header.
   *
   *   Column layout:
   *     #, Student, Activity, [Committee OR Delete], Points, Description, Date
   *   Manager:  Committee cell replaces Delete cell (no delete for manager)
   *   Head:     Delete cell replaces Committee cell
   */
  async function renderTable() {
    const tbody   = document.getElementById('assignments-tbody');
    const countEl = document.getElementById('assignments-count-label');

    let assignments, committeesMap;
    try {
      [assignments, committeesMap] = await Promise.all([
        loadAssignments(activeCommitteeId),
        loadCommitteesMap()
      ]);
    } catch (err) {
      console.error('Failed to load assignments:', err);
      if (tbody) tbody.innerHTML = `<tr><td colspan="8">${Utils.emptyState('⚠️', 'Failed to load assignments. Please refresh.')}</td></tr>`;
      return;
    }

    if (countEl) {
      countEl.textContent = `${assignments.length} record${assignments.length !== 1 ? 's' : ''}`;
    }

    if (!tbody) return;

    const colspan = 8;

    if (!assignments.length) {
      tbody.innerHTML = `<tr><td colspan="${colspan}">${Utils.emptyState('📋', 'No assignments recorded yet')}</td></tr>`;
      return;
    }

    tbody.innerHTML = assignments.map((a, i) => {
      // Date was already being fetched correctly; it was only misaligned visually.
      const dateText = Utils.formatDate(a.assignedAt || a.createdAt || null);

      // Manager sees Committee cell; head sees Delete cell.
      const conditionalCell = profile.role === 'manager'
        ? `<td><span class="badge badge-green">${Utils.escapeHtml(committeesMap[a.committeeId] || a.committeeId || '-')}</span></td>`
        : `<td style="text-align:center;">
            <button
              class="delete-assignment-btn"
              type="button"
              data-id="${Utils.escapeHtml(a.id || '')}"
              data-member="${Utils.escapeHtml(a.memberName || 'Record')}"
              data-activity="${Utils.escapeHtml(a.activityName || '')}"
              title="Delete assignment"
              aria-label="Delete assignment"
              style="
                width:34px;height:34px;display:inline-flex;align-items:center;
                justify-content:center;background:transparent;
                border:1px solid rgba(255,255,255,0.08);border-radius:10px;
                cursor:pointer;transition:0.2s ease;
              "
              onmouseover="this.style.background='rgba(255,255,255,0.05)';this.style.borderColor='rgba(255,255,255,0.14)'"
              onmouseout="this.style.background='transparent';this.style.borderColor='rgba(255,255,255,0.08)'"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                fill="none" stroke="#9CA3AF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 6h18"/><path d="M8 6V4h8v2"/>
                <path d="M19 6l-1 14H6L5 6"/>
                <path d="M10 11v6"/><path d="M14 11v6"/>
              </svg>
            </button>
          </td>`;

      return `
        <tr>
          <td class="row-index">${i + 1}</td>
          <td><strong>${Utils.escapeHtml(a.memberName || '')}</strong></td>
          <td>${Utils.escapeHtml(a.activityName || '')}</td>
          
          <td><span class="pts-pill">${Number(a.points || 0)} pts</span></td>
          <td style="color:rgba(232,232,234,.55);font-size:12px">${Utils.escapeHtml(a.description || '—')}</td>
          <td style="color:rgba(232,232,234,.4);font-size:12px">${dateText}</td>
          ${conditionalCell}
        </tr>`;
    }).join('');
  }

  function clearForm() {
    Utils.resetFields(['asgn-student', 'asgn-activity', 'asgn-pts', 'asgn-desc']);
    Utils.clearErrors(['asgn-student', 'asgn-activity']);
  }
})();