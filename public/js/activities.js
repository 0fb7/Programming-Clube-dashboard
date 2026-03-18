import { requireAuth, logout } from "../firebase1/auth-guard.js";
import {
  loadActivities,
  addActivity,
  deleteActivity,
  activityCodeExists,
  loadCommitteesMap
} from "../firebase1/firestore-service.js";

(async function () {
  'use strict';

  // ── Show skeleton immediately ─────────────────────────────────────────────
  // FIX: colspan updated to 7.
  // New column layout: #, Activity Name, Activity ID, [Committee|Delete], Points, Created
  Utils.showTableSkeleton('activities-tbody', 7);

  const profile = await requireAuth();
  Utils.initSidebarUser();

  document.getElementById('logout-btn')?.addEventListener('click', logout);

  // ── Module-level state ────────────────────────────────────────────────────
  // activeCommitteeId: null = all (manager default), or specific id.
  let activeCommitteeId = profile.role === 'manager' ? null : profile.committeeId;

  // ── Delete handler ────────────────────────────────────────────────────────
  const tbody = document.getElementById('activities-tbody');
  tbody?.addEventListener('click', async (e) => {
    const btn = e.target.closest('.delete-activity-btn');
    if (!btn) return;

    const activityId   = btn.dataset.id;
    const activityName = btn.dataset.name || 'this activity';

    if (!confirm(`Are you sure you want to delete ${activityName}?`)) return;

    try {
      btn.disabled = true;
      await deleteActivity(activityId, profile.committeeId);
      await renderTable();
      Utils.toast('Activity deleted', 'success');
    } catch (error) {
      console.error(error);
      Utils.toast('Failed to delete activity', 'error');
    } finally {
      btn.disabled = false;
    }
  });

  // ── Role-based UI setup ───────────────────────────────────────────────────
  const formCard          = document.getElementById('activities-form-card');
  const addBtn            = document.getElementById('add-activity-btn');
  const clearBtn          = document.getElementById('clear-activity-btn');
  const committeeHeadCell = document.getElementById('committee-head-cell');
  const deleteHeadCell    = document.getElementById('delete-head-cell');

  if (profile.role === 'manager') {
    if (formCard) formCard.style.display = 'none';
    if (committeeHeadCell) committeeHeadCell.style.display = '';
    if (deleteHeadCell) deleteHeadCell.style.display = 'none';

    await _initManagerFilter();
  } else {
    addBtn?.addEventListener('click', addActivityHandler);
    clearBtn?.addEventListener('click', clearForm);
  }

  await renderTable();

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

  async function addActivityHandler() {
    const name         = Utils.val('a-name');
    const activityCode = Utils.val('a-id');
    const pointsValue  = Utils.val('a-pts');

    const controls = ['a-name', 'a-id', 'a-pts'];
    Utils.clearErrors(controls);

    let valid = true;
    if (!name)         { Utils.showFieldError('a-name', 'err-a-name'); valid = false; }
    if (!activityCode) { Utils.showFieldError('a-id', 'err-a-id'); valid = false; }
    if (!pointsValue)  { Utils.showFieldError('a-pts', 'err-a-pts'); valid = false; }
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

    await addActivity(committeeId, { name, activityCode, points }, profile.uid);

    await renderTable();
    clearForm();
    Utils.showAlert('activity-form-alert', 'success', '✅ Activity created successfully!');
    Utils.toast('Activity created', 'success');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * FIX — Date column:
   *   addActivity() saves createdAt via serverTimestamp().
   *   The original code never read or displayed this field anywhere.
   *   Now: Utils.formatDate(a.createdAt) is rendered in a "Created" <td>.
   *
   * FIX — Column count & header mismatch:
   *   Original activities.html had no Delete <th>, so the delete <td> in the
   *   head role caused every column to be misaligned.
   *   New layout (7 total):
   *     #, Activity Name, Activity ID, [Committee OR Delete], Points, Created
   *   Both manager and head produce 6 fixed cells + 1 conditional = 7.
   */
  async function renderTable() {
    const tbody   = document.getElementById('activities-tbody');
    const countEl = document.getElementById('activities-count-label');

    let activities, committeesMap;
    try {
      [activities, committeesMap] = await Promise.all([
        loadActivities(activeCommitteeId),
        loadCommitteesMap()
      ]);
    } catch (err) {
      console.error('Failed to load activities:', err);
      if (tbody) tbody.innerHTML = `<tr><td colspan="7">${Utils.emptyState('⚠️', 'Failed to load activities. Please refresh.')}</td></tr>`;
      return;
    }

    if (countEl) {
      countEl.textContent = `${activities.length} activit${activities.length !== 1 ? 'ies' : 'y'}`;
    }

    if (!tbody) return;

    const colspan = 7;

    if (!activities.length) {
      tbody.innerHTML = `<tr><td colspan="${colspan}">${Utils.emptyState('⚡', 'No activities created yet')}</td></tr>`;
      return;
    }

    tbody.innerHTML = activities.map((a, i) => {
      // FIX: read and display createdAt.
      const createdDate = Utils.formatDate(a.createdAt || null);

      // Manager sees Committee cell; head sees Delete cell.
      const conditionalCell = profile.role === 'manager'
        ? `<td><span class="badge badge-green">${Utils.escapeHtml(committeesMap[a.committeeId] || a.committeeId || '-')}</span></td>`
        : `<td style="text-align:center;">
            <button
              class="delete-activity-btn"
              type="button"
              data-id="${Utils.escapeHtml(a.id || '')}"
              data-name="${Utils.escapeHtml(a.name || 'Activity')}"
              title="Delete activity"
              aria-label="Delete activity"
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
          <td><strong>${Utils.escapeHtml(a.name || '')}</strong></td>
          <td><code style="background:rgba(255,255,255,.06);padding:2px 8px;border-radius:5px;font-size:12px">${Utils.escapeHtml(a.activityCode || '')}</code></td>
          
          <td><span class="pts-pill">${Number(a.points || 0)} pts</span></td>
          <td style="font-size:12px;color:rgba(232,232,234,.45)">${createdDate}</td>
          ${conditionalCell}
        </tr>`;
    }).join('');
  }

  function clearForm() {
    Utils.resetFields(['a-name', 'a-id', 'a-pts']);
    Utils.clearErrors(['a-name', 'a-id', 'a-pts']);
  }
})();