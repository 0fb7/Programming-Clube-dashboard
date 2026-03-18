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

  // Show placeholder immediately while data loads.
  if (resultsContainer) {
    resultsContainer.innerHTML = Utils.emptyState("🔍", "Start typing to search students");
  }

  if (!searchInput || !resultsContainer) return;

  const committeeId = profile.role === "manager" ? null : profile.committeeId;

  let members = [];
  let assignmentsByMember = new Map(); // FIX: pre-grouped Map — O(1) lookup per member

  try {
    // Two parallel reads — both hit sessionStorage cache after first page load.
    const [membersData, assignmentsData] = await Promise.all([
      loadMembers(committeeId),
      loadAssignments(committeeId)
    ]);
    members = membersData;

    // FIX: build lookup map once at load time, not on every search keystroke.
    // Was: assignments.filter(a => a.memberId === m.id) called TWICE per result member
    //      = O(results × assignments) on every render.
    // Now: O(assignments) once here, then O(1) per member during render.
    for (const a of assignmentsData) {
      if (!assignmentsByMember.has(a.memberId)) assignmentsByMember.set(a.memberId, []);
      assignmentsByMember.get(a.memberId).push(a);
    }
  } catch (err) {
    console.error("Failed to load search data:", err);
    resultsContainer.innerHTML = Utils.emptyState("⚠️", "Failed to load data. Please refresh the page.");
    return;
  }

  // FIX: debounced at 200ms — was triggering full DOM rebuild on every single keypress.
  searchInput.addEventListener("input", Utils.debounce(e => {
    search(e.target.value);
  }, 200));

  function search(query) {
    if (!query.trim()) {
      resultsContainer.innerHTML = Utils.emptyState("🔍", "Start typing to search students");
      return;
    }

    const q = query.trim().toLowerCase();

    const results = members.filter(m =>
      (m.fullName || "").toLowerCase().includes(q) ||
      (m.phone || "").includes(q)
    );

    if (!results.length) {
      resultsContainer.innerHTML = Utils.emptyState("😔", `No students found for "<strong>${Utils.escapeHtml(query)}</strong>"`);
      return;
    }

    const countHtml = `
      <div style="margin-bottom:12px;font-size:12px;color:rgba(232,232,234,.4)">
        ${results.length} result${results.length !== 1 ? "s" : ""} found
      </div>`;

    // FIX: each member's assignments are now fetched via Map.get() — O(1).
    // Previously called assignments.filter() separately for table row AND history
    // section, scanning the full array twice per member.
    const tableHtml = `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th><th>Phone</th><th>Major</th>
              <th>Level</th><th>Gender</th><th>Total Points</th><th>Assignments</th>
            </tr>
          </thead>
          <tbody>
            ${results.map(m => {
              const studentAssignments = assignmentsByMember.get(m.id) || [];
              const totalPoints = studentAssignments.reduce((sum, a) => sum + Number(a.points || 0), 0);
              return `
                <tr>
                  <td><strong>${Utils.highlight(Utils.escapeHtml(m.fullName || ""), query)}</strong></td>
                  <td style="font-size:12px">${Utils.highlight(Utils.escapeHtml(m.phone || ""), query)}</td>
                  <td>${Utils.escapeHtml(m.major || "")}</td>
                  <td><span class="badge badge-blue">${Utils.escapeHtml(m.level || "")}</span></td>
                  <td>${Utils.escapeHtml(m.gender || "")}</td>
                  <td><span class="pts-pill">${totalPoints} pts</span></td>
                  <td><span class="badge badge-green">${studentAssignments.length}</span></td>
                </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>`;

    const historyHtml = results.map(m => {
      const studentAssignments = assignmentsByMember.get(m.id) || [];  // O(1), no re-filter
      if (!studentAssignments.length) return "";

      return `
        <div class="card" style="margin-top:16px;margin-bottom:0">
          <div class="card-header">
            <div class="card-title">${Utils.escapeHtml(m.fullName || "")}'s Activity History</div>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Activity</th><th>Points</th><th>Description</th><th>Date</th>
                </tr>
              </thead>
              <tbody>
                ${studentAssignments.map(a => `
                  <tr>
                    <td>${Utils.escapeHtml(a.activityName || "")}</td>
                    <td><span class="pts-pill">${Number(a.points || 0)}</span></td>
                    <td style="font-size:12px;color:rgba(232,232,234,.55)">${Utils.escapeHtml(a.description || "—")}</td>
                    <td style="font-size:12px;color:rgba(232,232,234,.4)">${Utils.formatDate(a.assignedAt || a.createdAt)}</td>
                  </tr>`).join("")}
              </tbody>
            </table>
          </div>
        </div>`;
    }).join("");

    resultsContainer.innerHTML = countHtml + tableHtml + historyHtml;
  }
})();