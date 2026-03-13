import { requireAuth, logout } from "../firebase/auth-guard.js";
import { loadOverviewData } from "../firebase/firestore-service.js";

(async function () {
  "use strict";

  const profile = await requireAuth();
  Utils.initSidebarUser();

  document.getElementById("logout-btn")?.addEventListener("click", logout);

  const committeeId = profile.role === "manager" ? null : profile.committeeId;
  const data = await loadOverviewData(committeeId);

  renderStats(data);
  renderRecentAssignments(data.recentAssignments);
  renderTopStudents(data.topStudents);

  function renderStats(data) {
    setText("stat-students", data.members.length);
    setText("stat-activities", data.activities.length);
    setText("stat-assignments", data.assignments.length);
    setText("stat-pts", data.totalPoints);
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
          <small style="color:rgba(232,232,234,.4)">${escapeHtml(s.major || "")}</small>
        </div>
        <span class="pts-pill">${Number(s.totalPoints || 0)} pts</span>
      </div>
    `).join("");
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