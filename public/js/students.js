import { requireAuth, logout } from "../firebase1/auth-guard.js";
import { database } from "../firebase1/firebase-config.js";
import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  loadMembers,
  addMember,
  deleteMember,
  memberPhoneExists,
  loadAssignments
} from "../firebase1/firestore-service.js";

(async function () {
  'use strict';

  const profile = await requireAuth();
  Utils.initSidebarUser();

  document.getElementById('logout-btn')?.addEventListener('click', logout);
  document.getElementById('student-search')?.addEventListener('input', e => renderTable(e.target.value));

  const tbody = document.getElementById('students-tbody');
  tbody?.addEventListener('click', async (e) => {
    const btn = e.target.closest('.delete-student-btn');
    if (!btn) return;

    const memberId = btn.dataset.id;
    const memberName = btn.dataset.name || 'this student';

    const ok = confirm(`Are you sure you want to delete ${memberName}?`);
    if (!ok) return;

    try {
      btn.disabled = true;
      await deleteMember(memberId);
      await renderTable(document.getElementById('student-search')?.value || '');
      Utils.toast('Student deleted', 'success');
    } catch (error) {
      console.error(error);
      Utils.toast('Failed to delete student', 'error');
    }
  });

  const formCard = document.getElementById('students-form-card');
  const addBtn = document.getElementById('add-student-btn');
  const clearBtn = document.getElementById('clear-student-btn');
  const committeeHeadCell = document.getElementById('committee-head-cell');

  if (profile.role === 'manager') {
    if (formCard) formCard.style.display = 'none';
    if (committeeHeadCell) committeeHeadCell.style.display = '';
  } else {
    addBtn?.addEventListener('click', addStudent);
    clearBtn?.addEventListener('click', clearForm);
  }

  await renderTable();

  async function addStudent() {
    const fullName = Utils.val('s-name');
    const phone = Utils.val('s-phone');
    const major = Utils.val('s-major');
    const level = Utils.val('s-level');
    const gender = Utils.val('s-gender');

    const controls = ['s-name', 's-phone', 's-major', 's-level', 's-gender'];
    Utils.clearErrors(controls);

    let valid = true;
    if (!fullName) { Utils.showFieldError('s-name', 'err-s-name'); valid = false; }
    if (!phone) { Utils.showFieldError('s-phone', 'err-s-phone'); valid = false; }
    if (!major) { Utils.showFieldError('s-major', 'err-s-major'); valid = false; }
    if (!level) { Utils.showFieldError('s-level', 'err-s-level'); valid = false; }
    if (!gender) { Utils.showFieldError('s-gender', 'err-s-gender'); valid = false; }
    if (!valid) return;

    const committeeId = profile.committeeId;

    const exists = await memberPhoneExists(committeeId, phone);
    if (exists) {
      Utils.showAlert('student-form-alert', 'error', '⚠️ A member with this phone number already exists in this committee.');
      document.getElementById('s-phone')?.classList.add('error');
      return;
    }

    await addMember(
      committeeId,
      { fullName, phone, major, level, gender },
      profile.uid
    );

    await renderTable();
    clearForm();
    Utils.showAlert('student-form-alert', 'success', '✅ Member added successfully!');
    Utils.toast('Member added', 'success');
  }

  async function renderTable(filter = '') {
    const tbody = document.getElementById('students-tbody');
    const countEl = document.getElementById('students-count-label');

    const committeeId = profile.role === 'manager' ? null : profile.committeeId;

    const [members, assignments, committeesMap] = await Promise.all([
      loadMembers(committeeId),
      loadAssignments(committeeId),
      loadCommitteesMap()
    ]);

    const normalizedFilter = filter.trim().toLowerCase();

    const list = normalizedFilter
      ? members.filter(m =>
          (m.fullName || '').toLowerCase().includes(normalizedFilter) ||
          (m.phone || '').includes(normalizedFilter)
        )
      : members;

    if (countEl) {
      countEl.textContent = `${members.length} student${members.length !== 1 ? 's' : ''} registered`;
    }

    if (!tbody) return;

    const colspan = profile.role === 'manager' ? 9 : 8;

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="${colspan}">${emptyState('📭', normalizedFilter ? 'No students match your search' : 'No students added yet')}</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map((m, i) => {
      const committeeCell = profile.role === 'manager'
        ? `<td><span class="badge badge-green">${escapeHtml(committeesMap[m.committeeId] || m.committeeId || '-')}</span></td>`
        : '';

      return `
         <tr>
    <td class="row-index">${i + 1}</td>
    <td><strong>${escapeHtml(m.fullName || '')}</strong></td>
    <td style="font-size:12px;color:rgba(232,232,234,.6)">${escapeHtml(m.phone || '')}</td>
    <td>${escapeHtml(m.major || '')}</td>
    <td><span class="badge badge-blue">${escapeHtml(m.level || '')}</span></td>
    <td><span class="badge ${(m.gender || '') === 'Male' ? 'badge-sky' : 'badge-amber'}">${escapeHtml(m.gender || '')}</span></td>

    <td style="text-align:center;">
      <button
        class="delete-student-btn"
        type="button"
        data-id="${escapeHtml(m.id || '')}"
        data-name="${escapeHtml(m.fullName || 'Student')}"
        title="Delete student"
        aria-label="Delete student"
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
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#9CA3AF"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M3 6h18"/>
          <path d="M8 6V4h8v2"/>
          <path d="M19 6l-1 14H6L5 6"/>
          <path d="M10 11v6"/>
          <path d="M14 11v6"/>
        </svg>
      </button>
    </td>

    ${committeeCell}
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
    Utils.resetFields(['s-name', 's-phone', 's-major', 's-level', 's-gender']);
    Utils.clearErrors(['s-name', 's-phone', 's-major', 's-level', 's-gender']);
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