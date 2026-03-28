import { requireAuth, logout } from "../firebase1/auth-guard.js";
import {
  loadMembers,
  addMember,
  deleteMember,
  memberPhoneExists,
  loadCommitteesMap
} from "../firebase1/firestore-service.js";

(async function () {
  'use strict';

  // ── Show skeleton immediately ─────────────────────────────────────────────
  // FIX: colspan updated to 9 (was 8 — "Total Points" th had no matching td).
  // New column layout: #, Name, Phone, Major, Level, Gender, Registered, [Committee|Delete]
  Utils.showTableSkeleton('students-tbody', 9);

  const profile = await requireAuth();
  Utils.initSidebarUser();

  document.getElementById('logout-btn')?.addEventListener('click', logout);

  // ── Module-level state ────────────────────────────────────────────────────
  let cachedMembers      = [];
  let cachedCommitteesMap = {};

  // activeCommitteeId:
  //   - For 'head' role: always profile.committeeId (never changes).
  //   - For 'manager' role: null = all committees, or a specific committeeId
  //     when the manager has selected one from the filter dropdown.
  let activeCommitteeId = profile.role === 'manager' ? null : profile.committeeId;

  // ── Delete handler ────────────────────────────────────────────────────────
  const tbody = document.getElementById('students-tbody');
  tbody?.addEventListener('click', async (e) => {
    const btn = e.target.closest('.delete-student-btn');
    if (!btn) return;

    const memberId   = btn.dataset.id;
    const memberName = btn.dataset.name || 'this student';

    if (!confirm(`Are you sure you want to delete ${memberName}?`)) return;

    try {
      btn.disabled = true;
      await deleteMember(memberId, profile.committeeId);
      await refreshData();
      renderTable(document.getElementById('student-search')?.value || '');
      Utils.toast('Student deleted', 'success');
    } catch (error) {
      console.error(error);
      Utils.toast('Failed to delete student', 'error');
    } finally {
      btn.disabled = false;
    }
  });

  // ── Role-based UI setup ───────────────────────────────────────────────────
  const formCard         = document.getElementById('students-form-card');
  const addBtn           = document.getElementById('add-student-btn');
  const clearBtn         = document.getElementById('clear-student-btn');
  const committeeHeadCell = document.getElementById('committee-head-cell');
  const deleteHeadCell   = document.getElementById('delete-head-cell');

  if (profile.role === 'manager') {
    // Manager: hide the add-student form, show the Committee column,
    // hide the Action (delete) column, and show the filter card.
    if (formCard) formCard.style.display = 'none';
    if (committeeHeadCell) committeeHeadCell.style.display = '';
    if (deleteHeadCell) deleteHeadCell.style.display = 'none';

    await _initManagerFilter();
  } else {
    addBtn?.addEventListener('click', addStudent);
    clearBtn?.addEventListener('click', clearForm);
  }

  // ── Search (in-memory, debounced) ─────────────────────────────────────────
  document.getElementById('student-search')?.addEventListener(
    'input',
    Utils.debounce(e => renderTable(e.target.value), 200)
  );

  // ── Initial data load ─────────────────────────────────────────────────────
  await refreshData();
  renderTable();

  // ═══════════════════════════════════════════════════════════════════════════
  // MANAGER FILTER
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Shows the filter card, populates the committee <select> from
   * loadCommitteesMap(), and wires the change event so selecting a committee
   * re-fetches and re-renders with that scope.
   */
  async function _initManagerFilter() {
    const filterCard   = document.getElementById('manager-filter-card');
    const filterSelect = document.getElementById('committee-filter-select');
    if (!filterCard || !filterSelect) return;

    filterCard.style.display = 'block';

    // Populate the dropdown — loadCommitteesMap() uses sessionStorage cache.
    const committeesMap = await loadCommitteesMap();
    const entries = Object.entries(committeesMap);

    if (entries.length) {
      filterSelect.innerHTML =
        '<option value="all">All Committees</option>' +
        entries.map(([id, name]) =>
          `<option value="${Utils.escapeHtml(id)}">${Utils.escapeHtml(name)}</option>`
        ).join('');
    }

    // On change: update the active scope, re-fetch, re-render.
    filterSelect.addEventListener('change', Utils.debounce(async () => {
      const val = filterSelect.value;
      activeCommitteeId = val === 'all' ? null : val;
      await refreshData();
      renderTable(document.getElementById('student-search')?.value || '');
    }, 300));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DATA
  // ═══════════════════════════════════════════════════════════════════════════

  async function refreshData() {
    try {
      [cachedMembers, cachedCommitteesMap] = await Promise.all([
        loadMembers(activeCommitteeId),
        loadCommitteesMap()
      ]);
    } catch (err) {
      console.error('Failed to load student data:', err);
      const tbody = document.getElementById('students-tbody');
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="9">${Utils.emptyState('⚠️', 'Failed to load data. Please refresh the page.')}</td></tr>`;
      }
    }
  }

  async function addStudent() {
    const fullName = Utils.val('s-name');
    const phone    = Utils.val('s-phone');
    const major    = Utils.val('s-major');
    const level    = Utils.val('s-level');
    const gender   = Utils.val('s-gender');

    const controls = ['s-name', 's-phone', 's-major', 's-level', 's-gender'];
    Utils.clearErrors(controls);

    let valid = true;
    if (!fullName) { Utils.showFieldError('s-name', 'err-s-name'); valid = false; }
    if (!phone)    { Utils.showFieldError('s-phone', 'err-s-phone'); valid = false; }
    if (!major)    { Utils.showFieldError('s-major', 'err-s-major'); valid = false; }
    if (!level)    { Utils.showFieldError('s-level', 'err-s-level'); valid = false; }
    if (!gender)   { Utils.showFieldError('s-gender', 'err-s-gender'); valid = false; }
    if (!valid) return;

    const committeeId = profile.committeeId;

    const exists = await memberPhoneExists(committeeId, phone);
    if (exists) {
      Utils.showAlert('student-form-alert', 'error', '⚠️ A member with this phone number already exists in this committee.');
      document.getElementById('s-phone')?.classList.add('error');
      return;
    }

    await addMember(committeeId, { fullName, phone, major, level, gender }, profile.uid);

    await refreshData();
    renderTable();
    clearForm();
    Utils.showAlert('student-form-alert', 'success', '✅ Member added successfully!');
    Utils.toast('Member added', 'success');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  function renderTable(filter = '') {
    const tbody    = document.getElementById('students-tbody');
    const countEl  = document.getElementById('students-count-label');

    const normalizedFilter = (filter || '').trim().toLowerCase();

    const list = normalizedFilter
      ? cachedMembers.filter(m =>
          (m.fullName || '').toLowerCase().includes(normalizedFilter) ||
          (m.phone || '').includes(normalizedFilter)
        )
      : cachedMembers;

    if (countEl) {
      countEl.textContent = `${cachedMembers.length} student${cachedMembers.length !== 1 ? 's' : ''} registered`;
    }

    if (!tbody) return;

    const colspan = 9;

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="${colspan}">${Utils.emptyState('📭', normalizedFilter ? 'No students match your search' : 'No students added yet')}</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map((m, i) => {
      // FIX: read createdAt from the Firestore doc and format it.
      const registeredDate = Utils.formatDate(m.createdAt || null);

      // Manager sees Committee cell; head sees Delete cell.
      const conditionalCell = profile.role === 'manager'
        ? `<td><span class="badge badge-green">${Utils.escapeHtml(cachedCommitteesMap[m.committeeId] || m.committeeId || '-')}</span></td>`
        : `<td style="text-align:center;">
            <button
              class="delete-student-btn"
              type="button"
              data-id="${Utils.escapeHtml(m.id || '')}"
              data-name="${Utils.escapeHtml(m.fullName || 'Student')}"
              title="Delete student"
              aria-label="Delete student"
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
          <td><strong>${Utils.escapeHtml(m.fullName || '')}</strong></td>
          <td style="font-size:12px;color:rgba(232,232,234,.6)">${Utils.escapeHtml(m.phone || '')}</td>
          <td>${Utils.escapeHtml(m.major || '')}</td>
          <td><span class="badge badge-blue">${Utils.escapeHtml(m.level || '')}</span></td>
          <td><span class="badge ${(m.gender || '') === 'Male' ? 'badge-sky' : 'badge-amber'}">${Utils.escapeHtml(m.gender || '')}</span></td>
          <td style="font-size:12px;color:rgba(232,232,234,.45)">${registeredDate}</td>
          ${conditionalCell}
        </tr>`;
    }).join('');
  }

  function clearForm() {
    Utils.resetFields(['s-name', 's-phone', 's-major', 's-level', 's-gender']);
    Utils.clearErrors(['s-name', 's-phone', 's-major', 's-level', 's-gender']);
  }
})();