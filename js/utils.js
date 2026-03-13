/* ============================================================
   utils.js — Shared UI Utilities
   UI helpers only (Firebase auth moved to /firebase/auth-guard.js)
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
     Reads the stored user profile from sessionStorage
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

    const avatarEl = document.getElementById('sidebar-avatar');
    const nameEl = document.getElementById('sidebar-username');

    if (avatarEl) avatarEl.textContent = displayName.charAt(0).toUpperCase();
    if (nameEl) nameEl.textContent = displayName;
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
  };
})();