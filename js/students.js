import { requireAuth, logout } from "../firebase/auth-guard.js";
import {
  loadMembers,
  addMember,
  memberPhoneExists,
  loadAssignments
} from "../firebase/firestore-service.js";

(async function () {
  'use strict';

  const profile = await requireAuth();
  Utils.initSidebarUser();

  document.getElementById('logout-btn')?.addEventListener('click', logout);
  document.getElementById('add-student-btn')?.addEventListener('click', addStudent);
  document.getElementById('clear-student-btn')?.addEventListener('click', clearForm);
  document.getElementById('student-search')?.addEventListener('input', e => renderTable(e.target.value));

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

    const committeeId =
      profile.role === 'manager'
        ? (Utils.val('s-committee') || 'committee1')
        : profile.committeeId;

    const exists = await memberPhoneExists(committeeId, phone);
    if (exists) {
      Utils.showAlert('student-form-alert', 'error', '⚠️ A member with this phone number already exists in this committee.');
      document.getElementById('s-phone')?.classList.add('error');
      return;
    }

    await addMember(
      committeeId,
      {
        fullName,
        phone,
        major,
        level,
        gender
      },
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

    const [members, assignments] = await Promise.all([
      loadMembers(committeeId),
      loadAssignments(committeeId)
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

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="7">${emptyState('📭', normalizedFilter ? 'No students match your search' : 'No students added yet')}</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map((m, i) => {
      const pts = assignments
        .filter(a => a.memberId === m.id)
        .reduce((sum, a) => sum + Number(a.points || 0), 0);

      return `
        <tr>
          <td class="row-index">${i + 1}</td>
          <td><strong>${escapeHtml(m.fullName || '')}</strong></td>
          <td style="font-size:12px;color:rgba(232,232,234,.6)">${escapeHtml(m.phone || '')}</td>
          <td>${escapeHtml(m.major || '')}</td>
          <td><span class="badge badge-blue">${escapeHtml(m.level || '')}</span></td>
          <td><span class="badge ${(m.gender || '') === 'Male' ? 'badge-sky' : 'badge-amber'}">${escapeHtml(m.gender || '')}</span></td>
          <td><span class="pts-pill">${pts} pts</span></td>
        </tr>
      `;
    }).join('');
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