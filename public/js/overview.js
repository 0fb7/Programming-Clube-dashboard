import { requireAuth, logout } from "../firebase1/auth-guard.js";
import { database } from "../firebase1/firebase-config.js";
import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { loadOverviewData } from "../firebase1/firestore-service.js";

(async function () {
  "use strict";

  const profile = await requireAuth();
  Utils.initSidebarUser();

  document.getElementById("logout-btn")?.addEventListener("click", logout);

  const managerFilterCard = document.getElementById("manager-filter-card");
  const filterSelect = document.getElementById("overview-committee-filter");

  const committeesMap = await loadCommitteesMap();
  const committeesList = Object.entries(committeesMap).map(([committeeId, name]) => ({
    committeeId,
    name
  }));

  if (profile.role === "manager") {
    if (managerFilterCard) managerFilterCard.style.display = "block";
    populateManagerFilter(filterSelect, committeesList);

    filterSelect?.addEventListener("change", async () => {
      const selected = filterSelect.value === "all" ? null : filterSelect.value;
      const data = await loadOverviewData(selected);
      renderAll(data, true);
    });

    const initialData = await loadOverviewData(null);
    renderAll(initialData, true);
  } else {
    if (managerFilterCard) managerFilterCard.style.display = "none";
    const data = await loadOverviewData(profile.committeeId);
    renderAll(data, false);
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
      container.innerHTML = emptyState("🏢", "No committees found");
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
          <div class="stat-label" style="font-size:16px;margin-bottom:10px">${escapeHtml(c.name || c.committeeId || "")}</div>
          <div style="display:grid;gap:8px;text-align:left">
            <div>👨‍💻 <strong>${membersCount}</strong> Members</div>
            <div>⚡ <strong>${activitiesCount}</strong> Activities</div>
            <div>📋 <strong>${assignmentsCount}</strong> Assignments</div>
            <div>🏆 <strong>${totalPoints}</strong> Points</div>
          </div>
        </div>
      `;
    }).join("");
  }

  function renderRecentAssignments(list) {
    const container = document.getElementById("overview-recent-assignments");
    if (!container) return;

    if (!list.length) {
      container.innerHTML = emptyState("📭", "No assignments yet");
      return;
    }

    container.innerHTML = list.map(a => `
      <div class="activity-feed-item">
        <div class="af-dot"></div>
        <div class="af-text">
          <strong>${escapeHtml(a.memberName || "")}</strong> — ${escapeHtml(a.activityName || "")}
          ${profile.role === "manager"
            ? `<br><small style="color:rgba(232,232,234,.4)">🏢 ${escapeHtml(committeesMap[a.committeeId] || a.committeeId || "-")}</small>`
            : ""}
        </div>
        <div class="af-time"><span class="pts-pill">${Number(a.points || 0)} pts</span></div>
      </div>
    `).join("");
  }

  function renderTopStudents(list) {
    const container = document.getElementById("overview-top-students");
    if (!container) return;

    const medals = ["🥇", "🥈", "🥉"];

    if (!list.length) {
      container.innerHTML = emptyState("🏆", "No data yet");
      return;
    }

    container.innerHTML = list.map((s, i) => `
      <div class="activity-feed-item">
        <div style="font-size:18px">${medals[i] || "🏅"}</div>
        <div class="af-text">
          <strong>${escapeHtml(s.fullName || "")}</strong><br>
          <small style="color:rgba(232,232,234,.4)">
            ${escapeHtml(s.major || "")}
            ${profile.role === "manager"
              ? ` · 🏢 ${escapeHtml(committeesMap[s.committeeId] || s.committeeId || "-")}`
              : ""}
          </small>
        </div>
        <span class="pts-pill">${Number(s.totalPoints || 0)} pts</span>
      </div>
    `).join("");
  }

  function populateManagerFilter(selectEl, committees) {
    if (!selectEl) return;

    selectEl.innerHTML = `
      <option value="all">All Committees</option>
      ${committees.map(c => `<option value="${c.committeeId}">${escapeHtml(c.name)}</option>`).join("")}
    `;
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

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function emptyState(emoji, text) {
    return `<div class="empty-state"><div class="emoji">${emoji}</div><p>${text}</p></div>`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
})();