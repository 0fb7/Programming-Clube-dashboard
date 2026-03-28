/* ============================================================
   utils.js — Shared UI Utilities
   ============================================================ */

(function () {
  'use strict';

  /* ----------------------------------------------------------
     TOAST NOTIFICATIONS
  ---------------------------------------------------------- */
  function toast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const icons = {
      success: '✅',
      error: '❌',
      info: 'ℹ️',
      warning: '⚠️'
    };

    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${message}</span>`;
    container.appendChild(el);

    setTimeout(() => {
      el.style.animation = 'slideOut 0.3s ease forwards';
      setTimeout(() => el.remove(), 300);
    }, 3000);
  }

  /* ----------------------------------------------------------
     INLINE ALERT (inside a card)
  ---------------------------------------------------------- */
  function showAlert(elementId, type, message) {
    const el = document.getElementById(elementId);
    if (!el) return;

    el.className = `alert alert-${type}`;
    el.innerHTML = message;
    el.classList.remove('hidden');

    setTimeout(() => {
      el.classList.add('hidden');
    }, 4500);
  }

  /* ----------------------------------------------------------
     FORM HELPERS
  ---------------------------------------------------------- */
  function val(id) {
    const el = document.getElementById(id);
    if (!el) return '';
    return typeof el.value === 'string' ? el.value.trim() : '';
  }

  function showFieldError(controlId, errorId) {
    const ctrl = document.getElementById(controlId);
    const errEl = document.getElementById(errorId);
    if (ctrl) ctrl.classList.add('error');
    if (errEl) errEl.classList.remove('hidden');
  }

  function clearErrors(controlIds) {
    controlIds.forEach(id => {
      const ctrl = document.getElementById(id);
      const errEl = document.getElementById('err-' + id);
      if (ctrl) ctrl.classList.remove('error');
      if (errEl) errEl.classList.add('hidden');
    });
  }

  function resetFields(fieldIds) {
    fieldIds.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      if (el.tagName === 'SELECT') {
        el.selectedIndex = 0;
      } else {
        el.value = '';
      }
    });
  }

  /* ----------------------------------------------------------
     SIDEBAR USER INFO
  ---------------------------------------------------------- */
 function initSidebarUser() {
  const raw = sessionStorage.getItem('cc_user');
  let user = null;

  try {
    user = raw ? JSON.parse(raw) : null;
  } catch {
    user = null;
  }

  const displayName =
    user?.displayName ||
    user?.name ||
    user?.email ||
    'Admin';

  const roleLabel =
    user?.title ||
    (user?.role === 'manager' ? 'President' :
     user?.role === 'committee' ? 'Committee Head' :
     'Administrator');

  const avatarEl = document.getElementById('sidebar-avatar');
  const nameEl = document.getElementById('sidebar-username');
  const roleEl = document.getElementById('sidebar-role-label');

  if (avatarEl) avatarEl.textContent = displayName.charAt(0).toUpperCase();
  if (nameEl) nameEl.textContent = displayName;
  if (roleEl) roleEl.textContent = roleLabel;
}

  /* ----------------------------------------------------------
     HIGHLIGHT (search term in text)
  ---------------------------------------------------------- */
  function highlight(text, query) {
    if (!query) return text;
    const safeText = String(text ?? '');
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(${escaped})`, 'gi');
    return safeText.replace(
      re,
      '<mark style="background:rgba(70,99,222,.3);color:var(--blue);border-radius:3px;padding:0 2px">$1</mark>'
    );
  }

  /* ----------------------------------------------------------
     ESCAPE HTML
     FIX: was duplicated identically in activities.js, assignments.js,
     leaderboard.js, overview.js, search.js, students.js (6 copies).
     Single authoritative version here, exposed on window.Utils.
  ---------------------------------------------------------- */
  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ----------------------------------------------------------
     EMPTY STATE HTML
     FIX: was duplicated in every page file.
  ---------------------------------------------------------- */
  function emptyState(emoji, text) {
    return `<div class="empty-state"><div class="emoji">${emoji}</div><p>${text}</p></div>`;
  }

  /* ----------------------------------------------------------
     FORMAT DATE
     FIX: was duplicated in assignments.js and search.js.
  ---------------------------------------------------------- */
 function formatDate(value) {
  if (!value) return '—';

  try {
    // Firestore Timestamp مباشر
    if (typeof value.toDate === 'function') {
      return value.toDate().toLocaleDateString('en-GB');
    }

    // Firestore Timestamp بعد sessionStorage/JSON.parse
    if (
      typeof value === 'object' &&
      value !== null &&
      typeof value.seconds === 'number'
    ) {
      const d = new Date(value.seconds * 1000);
      return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB');
    }

    // string / number / Date
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB');
  } catch {
    return '—';
  }
}

  /* ----------------------------------------------------------
     SKELETON TABLE ROWS
     FIX: No page showed any loading state — the user saw a
     completely blank table until all Firestore reads resolved.
     Call showTableSkeleton(tbodyId, cols) right after page init,
     before any async call, to give immediate visual feedback.
  ---------------------------------------------------------- */
  function showTableSkeleton(tbodyId, cols = 5, rows = 5) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;

    const cell = `<td><div class="skeleton-line"></div></td>`;
    const row = `<tr>${cell.repeat(cols)}</tr>`;
    tbody.innerHTML = row.repeat(rows);
  }

  /* ----------------------------------------------------------
     DEBOUNCE
     FIX: search inputs and the overview committee filter had no
     debounce. Every keystroke triggered a full DOM re-render
     (students/search) or a Firestore read (overview filter).
     Use: const handler = Utils.debounce(fn, 250);
  ---------------------------------------------------------- */
  function debounce(fn, delay = 250) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  /* ----------------------------------------------------------
     EXPOSE GLOBALLY
  ---------------------------------------------------------- */
  window.Utils = {
    toast,
    showAlert,
    val,
    showFieldError,
    clearErrors,
    resetFields,
    initSidebarUser,
    highlight,
    escapeHtml,
    emptyState,
    formatDate,
    showTableSkeleton,
    debounce,
  };
})();