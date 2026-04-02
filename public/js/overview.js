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
  const committeeIcons = {
  committee1: `
    <svg viewBox="0 0 512 512" aria-hidden="true">
      <path d="M81.4,259.724l119.288-55.416v26.344l-90.216,39.512v0.496l90.216,39.512v26.344L81.4,281.1V259.724z"></path>
      <path d="M219.104,346.46l53.184-180.184h25.104L244.208,346.46H219.104z"></path>
      <path d="M431.112,281.836l-119.288,54.68v-26.344L404,270.66v-0.496l-92.176-39.52v-26.328l119.288,54.68V281.836z"></path>
    </svg>
  `,
  committee2: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 4.5h6l1.2 2H19A2.5 2.5 0 0 1 21.5 9v8A2.5 2.5 0 0 1 19 19.5H5A2.5 2.5 0 0 1 2.5 17V9A2.5 2.5 0 0 1 5 6.5h2.8L9 4.5Z"></path>
      <circle cx="12" cy="13" r="3.2" fill="rgba(255,255,255,0.92)"></circle>
    </svg>
  `,
  committee3: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12,2a8,8,0,0,0-8,8v1.9A2.92,2.92,0,0,0,3,14a2.88,2.88,0,0,0,1.94,2.61C6.24,19.72,8.85,22,12,22h3V20H12c-2.26,0-4.31-1.7-5.34-4.39l-.21-.55L5.86,15A1,1,0,0,1,5,14a1,1,0,0,1,.5-.86l.5-.29V11a1,1,0,0,1,1-1H17a1,1,0,0,1,1,1v5H13.91a1.5,1.5,0,1,0-1.52,2H20a2,2,0,0,0,2-2V14a2,2,0,0,0-2-2V10A8,8,0,0,0,12,2Z"></path>
    </svg>
  `,
  committee4: `
    <svg viewBox="0 0 512 512" aria-hidden="true">
      <path d="M257.324,90.939c25.132,0,45.473-20.36,45.473-45.466C302.797,20.35,282.456,0,257.324,0c-25.123,0-45.474,20.35-45.474,45.473C211.85,70.579,232.201,90.939,257.324,90.939z"></path>
      <path d="M258.24,194.075h61.45c0,0,14.749-31.952-1.513-60.266c-9.19-16.002-30.716-25.771-59.937-25.771c-29.23,0-50.756,9.769-59.946,25.771c-16.261,28.314-1.513,60.266-1.513,60.266H258.24z"></path>
      <path d="M69.586,408.855c25.131,0,45.482-20.359,45.482-45.465c0-25.131-20.351-45.464-45.482-45.464c-25.132,0-45.482,20.334-45.482,45.464C24.104,388.496,44.454,408.855,69.586,408.855z"></path>
      <path d="M70.51,425.973c-29.229,0-50.755,9.76-59.945,25.745C-5.705,480.048,9.053,512,9.053,512H70.51h61.45c0,0,14.748-31.952-1.522-60.282C121.258,435.733,99.731,425.973,70.51,425.973z"></path>
      <path d="M440.575,408.855c25.132,0,45.482-20.359,45.482-45.465c0-25.131-20.35-45.464-45.482-45.464c-25.123,0-45.474,20.334-45.474,45.464C395.102,388.496,415.452,408.855,440.575,408.855z"></path>
      <path d="M501.428,451.718c-9.172-15.985-30.707-25.745-59.928-25.745c-29.23,0-50.756,9.76-59.936,25.745C365.293,480.048,380.05,512,380.05,512h61.45h61.45C502.95,512,517.707,480.048,501.428,451.718z"></path>
      <path d="M267.559,337.385V225.154h-19.469v112.206l-96.428,55.683l8.974,15.315l96.172-55.114l96.428,55.683l8.964-15.426L267.559,337.385z"></path>
    </svg>
  `
};

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
      <div class="stat-icon stat-icon-${c.committeeId}">
        ${committeeIcons[c.committeeId] || ""}
      </div>

      <div class="stat-label" style="font-size:16px;margin-bottom:10px">
        ${Utils.escapeHtml(c.name || c.committeeId || "")}
      </div>

      <div class="committee-stats-list">
  <div class="committee-stat-row" >
    <span class="committee-stat-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" style=" color: #8ba5ff;">
        <path d="M12 12a3.5 3.5 0 1 0-3.5-3.5A3.5 3.5 0 0 0 12 12Z"></path>
        <path d="M6.5 19a5.5 5.5 0 0 1 11 0"></path>
        <path d="M18.5 18.5a4.4 4.4 0 0 0-2.15-3.78"></path>
      </svg>
    </span>
    <span><strong>${membersCount}</strong> Members</span>
  </div>

  <div class="committee-stat-row" >
    <span class="committee-stat-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" style="color: #50d8ff;">
        <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"></path>
      </svg>
    </span>
    <span><strong>${activitiesCount}</strong> Activities</span>
  </div>

  <div class="committee-stat-row" ">
    <span class="committee-stat-icon" aria-hidden="true" >
      <svg viewBox="0 0 24 24" Style="color: #40d4a0;">
        <path d="M9 3.75A1.75 1.75 0 0 1 10.75 2h2.5A1.75 1.75 0 0 1 15 3.75V5h2.25A2.75 2.75 0 0 1 20 7.75v10.5A2.75 2.75 0 0 1 17.25 21H6.75A2.75 2.75 0 0 1 4 18.25V7.75A2.75 2.75 0 0 1 6.75 5H9V3.75Z"></path>
        <path d="M9 10h6"></path>
        <path d="M9 13h6"></path>
        <path d="M9 16h3"></path>
      </svg>
    </span>
    <span><strong>${assignmentsCount}</strong> Assignments</span>
  </div>

  <div class="committee-stat-row" >
    <span class="committee-stat-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" Style="color: #f5c050;">
        <path d="M12 3 14.4 7.86 20 8.67l-4 3.9.94 5.51L12 15.6l-4.94 2.48L8 12.57l-4-3.9 5.6-.81Z"></path>
      </svg>
    </span>
    <span><strong>${totalPoints}</strong> Points</span>
  </div>
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
          ? `<br><small style="color:rgba(232,232,234,.4)">
              <span class="committee-inline-icon" aria-hidden="true">
                ${committeeIcons[a.committeeId] || ""}
              </span>
              ${Utils.escapeHtml(committeesMap[a.committeeId] || a.committeeId || "-")}
            </small>`
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
              ? ` · <span class="committee-inline-icon" aria-hidden="true">${committeeIcons[s.committeeId] || ""}</span> ${Utils.escapeHtml(committeesMap[s.committeeId] || s.committeeId || "-")}`
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