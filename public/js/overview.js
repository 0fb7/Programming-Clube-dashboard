import { requireAuth, logout } from "../firebase1/auth-guard.js";
import { loadOverviewData, loadCommitteesMap } from "../firebase1/firestore-service.js";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import { auth } from "../firebase1/firebase-config.js";

(async function () {
  "use strict";

  // ── Show skeleton stat cards immediately ──────────────────────────────────
  ["stat-students", "stat-activities", "stat-assignments", "stat-pts"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '<span class="skeleton-line" style="width:40px;height:28px;display:inline-block"></span>';
  });

  const profile = await requireAuth();
  Utils.initSidebarUser();

  document.getElementById("logout-btn")?.addEventListener("click", logout);

  const currentPassInput = document.getElementById("current-pass");
const newPassInput = document.getElementById("new-pass");
const confirmPassInput = document.getElementById("confirm-pass");
const changePassBtn = document.getElementById("change-pass-btn");
const clearPassBtn = document.getElementById("clear-pass-btn");

changePassBtn?.addEventListener("click", handleChangePassword);
clearPassBtn?.addEventListener("click", clearPasswordForm);

  const managerFilterCard = document.getElementById("manager-filter-card");
  const filterSelect = document.getElementById("overview-committee-filter");

  let committeesMap = {};

  if (profile.role === "manager") {
    if (managerFilterCard) managerFilterCard.style.display = "block";

    let initialData;
    try {
      // Both reads fire in parallel and hit the sessionStorage cache on repeat visits.
      const [map, data] = await Promise.all([
        loadCommitteesMap(),
        loadOverviewData(null)
      ]);
      committeesMap = map;
      initialData = data;
    } catch (err) {
      console.error("Failed to load overview data:", err);
      _showOverviewError();
      return;
    }

    const committeesList = Object.entries(committeesMap).map(([committeeId, name]) => ({
      committeeId,
      name
    }));
    populateManagerFilter(filterSelect, committeesList);

    // FIX: debounce the select change so rapid switching doesn't stack multiple
    // Firestore reads. With caching these hits are free after first fetch,
    // but the debounce prevents redundant re-renders on accidental double-click.
    filterSelect?.addEventListener("change", Utils.debounce(async () => {
      const selected = filterSelect.value === "all" ? null : filterSelect.value;
      try {
        const data = await loadOverviewData(selected);
        renderAll(data, true);
      } catch (err) {
        console.error("Failed to load committee data:", err);
        _showOverviewError();
      }
    }, 300));

    renderAll(initialData, true);
  } else {
    if (managerFilterCard) managerFilterCard.style.display = "none";

    try {
      const [map, data] = await Promise.all([
        loadCommitteesMap(),
        loadOverviewData(profile.committeeId)
      ]);
      committeesMap = map;
      renderAll(data, false);
    } catch (err) {
      console.error("Failed to load overview data:", err);
      _showOverviewError();
    }
  }

  function renderAll(data, isManager) {
    renderStats(data);
    renderRecentAssignments(data.recentAssignments);
    renderTopStudents(data.topStudents);

    if (isManager) {
      renderCommitteesSummary(data);
    } else {
      const summarySection = document.getElementById("committees-summary-section");
      if (summarySection) summarySection.style.display = "none";
    }
  }

  function renderStats(data) {
    setText("stat-students", data.members.length);
    setText("stat-activities", data.activities.length);
    setText("stat-assignments", data.assignments.length);
    setText("stat-pts", data.totalPoints);
  }

  function renderCommitteesSummary(data) {
    const section = document.getElementById("committees-summary-section");
    const container = document.getElementById("committees-summary-grid");
    if (!section || !container) return;

    section.style.display = "block";

    const committees = Object.entries(committeesMap).map(([committeeId, name]) => ({
      committeeId,
      name
    }));

    if (!committees.length) {
      container.innerHTML = Utils.emptyState("🏢", "No committees found");
      return;
    }

    container.innerHTML = committees.map(c => {
      const membersCount = data.members.filter(m => m.committeeId === c.committeeId).length;
      const activitiesCount = data.activities.filter(a => a.committeeId === c.committeeId).length;
      const assignmentsCount = data.assignments.filter(a => a.committeeId === c.committeeId).length;
      const totalPoints = data.assignments
        .filter(a => a.committeeId === c.committeeId)
        .reduce((sum, a) => sum + Number(a.points || 0), 0);

      return `
        <div class="stat-card">
          <div class="stat-icon">🏢</div>
          <div class="stat-label" style="font-size:16px;margin-bottom:10px">${Utils.escapeHtml(c.name || c.committeeId || "")}</div>
          <div style="display:grid;gap:8px;text-align:left">
            <div>👨‍💻 <strong>${membersCount}</strong> Members</div>
            <div>⚡ <strong>${activitiesCount}</strong> Activities</div>
            <div>📋 <strong>${assignmentsCount}</strong> Assignments</div>
            <div>🏆 <strong>${totalPoints}</strong> Points</div>
          </div>
        </div>`;
    }).join("");
  }

  function renderRecentAssignments(list) {
    const container = document.getElementById("overview-recent-assignments");
    if (!container) return;

    if (!list.length) {
      container.innerHTML = Utils.emptyState("📭", "No assignments yet");
      return;
    }

    container.innerHTML = list.map(a => `
      <div class="activity-feed-item">
        <div class="af-dot"></div>
        <div class="af-text">
          <strong>${Utils.escapeHtml(a.memberName || "")}</strong> - ${Utils.escapeHtml(a.activityName || "")}
          ${profile.role === "manager"
            ? `<br><small style="color:rgba(232,232,234,.4)">🏢 ${Utils.escapeHtml(committeesMap[a.committeeId] || a.committeeId || "-")}</small>`
            : ""}
        </div>
        <div class="af-time"><span class="pts-pill">${Number(a.points || 0)} pts</span></div>
      </div>`).join("");
  }

  function renderTopStudents(list) {
    const container = document.getElementById("overview-top-students");
    if (!container) return;

    const medals = ["🥇", "🥈", "🥉"];

    if (!list.length) {
      container.innerHTML = Utils.emptyState("🏆", "No data yet");
      return;
    }

    const uniquePoints = [...new Set(list.map(s => Number(s.totalPoints || 0)))]
      .sort((a, b) => b - a);

    container.innerHTML = list.map((s) => {
      const sPts = Number(s.totalPoints || 0);
      const actualRank = uniquePoints.indexOf(sPts) + 1;
      const rankLabel = actualRank <= 3 ? medals[actualRank - 1] : actualRank;

      return `
        <div class="activity-feed-item">
          <div style="font-size:18px">${rankLabel}</div>
          <div class="af-text">
            <strong>${Utils.escapeHtml(s.fullName || "")}</strong><br>
            <small style="color:rgba(232,232,234,.4)">
              ${Utils.escapeHtml(s.major || "")}
              ${profile.role === "manager"
                ? ` · 🏢 ${Utils.escapeHtml(committeesMap[s.committeeId] || s.committeeId || "-")}`
                : ""}
            </small>
          </div>
          <span class="pts-pill">${sPts} pts</span>
        </div>`;
    }).join("");
  }

  function populateManagerFilter(selectEl, committees) {
    if (!selectEl) return;
    selectEl.innerHTML = `
      <option value="all">All Committees</option>
      ${committees.map(c => `<option value="${c.committeeId}">${Utils.escapeHtml(c.name)}</option>`).join("")}
    `;
  }

  function _showOverviewError() {
    ["overview-recent-assignments", "overview-top-students", "committees-summary-grid"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = Utils.emptyState("⚠️", "Failed to load data. Please refresh.");
    });
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  async function handleChangePassword() {
  const currentPassword = currentPassInput?.value ?? "";
  const newPassword = newPassInput?.value ?? "";
  const confirmPassword = confirmPassInput?.value ?? "";

  if (!currentPassword || !newPassword || !confirmPassword) {
    Utils.showAlert("change-pass-alert", "error", "⚠️ Please fill in all password fields.");
    return;
  }

  if (newPassword.length < 6) {
    Utils.showAlert("change-pass-alert", "error", "⚠️ New password must be at least 6 characters.");
    return;
  }

  if (newPassword !== confirmPassword) {
    Utils.showAlert("change-pass-alert", "error", "⚠️ New password and confirmation do not match.");
    return;
  }

  try {
    changePassBtn.disabled = true;
    changePassBtn.textContent = "Updating...";

    const user = auth.currentUser;

    if (!user || !user.email) {
      Utils.showAlert("change-pass-alert", "error", "⚠️ No authenticated user found.");
      return;
    }

    const credential = EmailAuthProvider.credential(user.email, currentPassword);

    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, newPassword);

    clearPasswordForm();
    Utils.showAlert("change-pass-alert", "success", "✅ Password updated successfully.");
    Utils.toast("Password changed successfully", "success");
  } catch (err) {
    console.error(err);

    if (
      err.code === "auth/wrong-password" ||
      err.code === "auth/invalid-credential" ||
      err.code === "auth/invalid-login-credentials"
    ) {
      Utils.showAlert("change-pass-alert", "error", "⚠️ Current password is incorrect.");
    } else if (err.code === "auth/weak-password") {
      Utils.showAlert("change-pass-alert", "error", "⚠️ New password is too weak.");
    } else if (err.code === "auth/too-many-requests") {
      Utils.showAlert("change-pass-alert", "error", "⚠️ Too many attempts. Please wait and try again.");
    } else if (err.code === "auth/network-request-failed") {
      Utils.showAlert("change-pass-alert", "error", "⚠️ Network error. Please check your connection.");
    } else {
      Utils.showAlert("change-pass-alert", "error", "⚠️ Failed to change password. Please try again.");
    }
  } finally {
    changePassBtn.disabled = false;
    changePassBtn.textContent = "Update Password";
  }
}

function clearPasswordForm() {
  currentPassInput && (currentPassInput.value = "");
  newPassInput && (newPassInput.value = "");
  confirmPassInput && (confirmPassInput.value = "");
}
})();