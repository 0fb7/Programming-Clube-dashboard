import { requireAuth, logout } from "../firebase1/auth-guard.js";
import {
  loadMembers,
  loadAssignments
} from "../firebase1/firestore-service.js";

(async function () {
  "use strict";

  const profile = await requireAuth();
  Utils.initSidebarUser();

  document.getElementById("logout-btn")?.addEventListener("click", logout);

  const searchInput = document.getElementById("global-search");
  const resultsContainer = document.getElementById("search-results");

  const committeeId = profile.role === "manager" ? null : profile.committeeId;

  const [members, assignments] = await Promise.all([
    loadMembers(committeeId),
    loadAssignments(committeeId)
  ]);

  searchInput?.addEventListener("input", e => {
    search(e.target.value);
  });

  function search(query) {
    if (!resultsContainer) return;

    if (!query.trim()) {
      resultsContainer.innerHTML = emptyState("🔍", "Start typing to search students");
      return;
    }

    const q = query.trim().toLowerCase();

    const results = members.filter(m =>
      (m.fullName || "").toLowerCase().includes(q) ||
      (m.phone || "").includes(q)
    );

    if (!results.length) {
      resultsContainer.innerHTML = emptyState("😔", `No students found for "<strong>${escapeHtml(query)}</strong>"`);
      return;
    }

    const countHtml = `
      <div style="margin-bottom:12px;font-size:12px;color:rgba(232,232,234,.4)">
        ${results.length} result${results.length !== 1 ? "s" : ""} found
      </div>`;

    const tableHtml = `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Major</th>
              <th>Level</th>
              <th>Gender</th>
              <th>Total Points</th>
              <th>Assignments</th>
            </tr>
          </thead>
          <tbody>
            ${results.map(m => {
              const studentAssignments = assignments.filter(a => a.memberId === m.id);
              const totalPoints = studentAssignments.reduce((sum, a) => sum + Number(a.points || 0), 0);

              return `
                <tr>
                  <td><strong>${Utils.highlight(escapeHtml(m.fullName || ""), query)}</strong></td>
                  <td style="font-size:12px">${Utils.highlight(escapeHtml(m.phone || ""), query)}</td>
                  <td>${escapeHtml(m.major || "")}</td>
                  <td><span class="badge badge-blue">${escapeHtml(m.level || "")}</span></td>
                  <td>${escapeHtml(m.gender || "")}</td>
                  <td><span class="pts-pill">${totalPoints} pts</span></td>
                  <td><span class="badge badge-green">${studentAssignments.length}</span></td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>`;

    const historyHtml = results.map(m => {
      const studentAssignments = assignments.filter(a => a.memberId === m.id);
      if (!studentAssignments.length) return "";

      return `
        <div class="card" style="margin-top:16px;margin-bottom:0">
          <div class="card-header">
            <div class="card-title">${escapeHtml(m.fullName || "")}'s Activity History</div>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Activity</th>
                  <th>Points</th>
                  <th>Description</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                ${studentAssignments.map(a => `
                  <tr>
                    <td>${escapeHtml(a.activityName || "")}</td>
                    <td><span class="pts-pill">${Number(a.points || 0)}</span></td>
                    <td style="font-size:12px;color:rgba(232,232,234,.55)">${escapeHtml(a.description || "—")}</td>
                    <td style="font-size:12px;color:rgba(232,232,234,.4)">${formatDate(a.assignedAt || a.createdAt)}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }).join("");

    resultsContainer.innerHTML = countHtml + tableHtml + historyHtml;
  }

  function formatDate(value) {
    if (!value) return "—";
    try {
      if (typeof value.toDate === "function") {
        return value.toDate().toLocaleDateString("en-GB");
      }
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-GB");
    } catch {
      return "—";
    }
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