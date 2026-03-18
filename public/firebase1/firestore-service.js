import { database } from "./firebase-config.js";
import {
  collection,
  getDocs,
  addDoc,
  query,
  where,
  serverTimestamp,
  doc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";



const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function _cacheKey(collection, committeeId) {
  return `fscache_${collection}_${committeeId ?? "__all__"}`;
}

function _readCache(key) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL_MS) {
      sessionStorage.removeItem(key);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function _writeCache(key, data) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
  } catch {
    // Storage quota exceeded — degrade gracefully, no caching.
  }
}

function _invalidateCache(collectionName, committeeId) {
  // Invalidate both the specific-committee key and the "all" key.
  try {
    sessionStorage.removeItem(_cacheKey(collectionName, committeeId));
    sessionStorage.removeItem(_cacheKey(collectionName, null));
  } catch { /* ignore */ }
}

// ─── COMMITTEES ─────────────────────────────────────────────────────────────
//
// Was: module-level JS variable (lost on every page navigation).
// Now: backed by sessionStorage so it survives navigation within the tab.

export async function loadCommitteesMap() {
  const key = _cacheKey("committees", null);
  const cached = _readCache(key);
  if (cached) return cached;

  const snap = await getDocs(collection(database, "committees"));
  const map = {};
  snap.forEach(d => {
    const data = d.data();
    map[data.committeeId || d.id] = data.name || data.committeeId || d.id;
  });

  _writeCache(key, map);
  return map;
}

export function invalidateCommitteesCache() {
  try {
    sessionStorage.removeItem(_cacheKey("committees", null));
  } catch { /* ignore */ }
}

// ─── MEMBERS ─────────────────────────────────────────────────────────────────

export async function loadMembers(committeeId = null) {
  const key = _cacheKey("members", committeeId);
  const cached = _readCache(key);
  if (cached) return cached;

  const ref = collection(database, "members");
  const q = committeeId
    ? query(ref, where("committeeId", "==", committeeId))
    : ref;

  const snap = await getDocs(q);
  const data = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => String(a.fullName || "").localeCompare(String(b.fullName || "")));

  _writeCache(key, data);
  return data;
}

export async function addMember(committeeId, data, createdBy) {
  const result = await addDoc(collection(database, "members"), {
    ...data,
    committeeId,
    createdBy,
    createdAt: serverTimestamp()
  });
  _invalidateCache("members", committeeId);
  return result;
}

export async function deleteMember(memberId, committeeId) {
  await deleteDoc(doc(database, "members", memberId));
  _invalidateCache("members", committeeId);
}

export async function memberPhoneExists(committeeId, phone) {
  // This is a validation query that must always be fresh — no cache.
  const ref = collection(database, "members");
  const q = query(
    ref,
    where("committeeId", "==", committeeId),
    where("phone", "==", phone)
  );
  const snap = await getDocs(q);
  return !snap.empty;
}

// ─── ACTIVITIES ───────────────────────────────────────────────────────────────

export async function loadActivities(committeeId = null) {
  const key = _cacheKey("activities", committeeId);
  const cached = _readCache(key);
  if (cached) return cached;

  const ref = collection(database, "activities");
  const q = committeeId
    ? query(ref, where("committeeId", "==", committeeId))
    : ref;

  const snap = await getDocs(q);
  const data = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));

  _writeCache(key, data);
  return data;
}

export async function addActivity(committeeId, data, createdBy) {
  const result = await addDoc(collection(database, "activities"), {
    ...data,
    committeeId,
    createdBy,
    createdAt: serverTimestamp()
  });
  _invalidateCache("activities", committeeId);
  return result;
}

export async function deleteActivity(activityId, committeeId) {
  await deleteDoc(doc(database, "activities", activityId));
  _invalidateCache("activities", committeeId);
}

export async function deleteAssignment(assignmentId, committeeId) {
  await deleteDoc(doc(database, "assignments", assignmentId));
  _invalidateCache("assignments", committeeId);
}

export async function activityCodeExists(committeeId, activityCode) {
  // Validation query — always fresh.
  const ref = collection(database, "activities");
  const q = query(
    ref,
    where("committeeId", "==", committeeId),
    where("activityCode", "==", activityCode)
  );
  const snap = await getDocs(q);
  return !snap.empty;
}

// ─── ASSIGNMENTS ──────────────────────────────────────────────────────────────

export async function loadAssignments(committeeId = null) {
  const key = _cacheKey("assignments", committeeId);
  const cached = _readCache(key);
  if (cached) return cached;

  const ref = collection(database, "assignments");
  const q = committeeId
    ? query(ref, where("committeeId", "==", committeeId))
    : ref;

  const snap = await getDocs(q);
  const data = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => {
      const da = toMillis(a.assignedAt || a.createdAt);
      const db = toMillis(b.assignedAt || b.createdAt);
      return db - da;
    });

  _writeCache(key, data);
  return data;
}

export async function addAssignment(committeeId, data, assignedBy) {
  const result = await addDoc(collection(database, "assignments"), {
    ...data,
    committeeId,
    assignedBy,
    assignedAt: serverTimestamp()
  });
  _invalidateCache("assignments", committeeId);
  return result;
}

// ─── LEADERBOARD ─────────────────────────────────────────────────────────────
// Fires exactly 2 reads: members + assignments (both now cached).

export async function loadLeaderboard(committeeId = null) {
  const [members, assignments] = await Promise.all([
    loadMembers(committeeId),
    loadAssignments(committeeId)
  ]);
  return buildLeaderboard(members, assignments);
}

/**
 * Pure in-memory leaderboard builder — zero Firestore reads.
 *
 * FIX: was O(n × m) — assignments.filter() ran inside members.map(), scanning
 * the full assignments array once per member. For 50 members × 200 assignments
 * that is 10,000 passes per render.
 *
 * Now O(n + m): group assignments into a Map<memberId, Assignment[]> in one
 * linear pass, then look up each member's slice in O(1).
 */
export function buildLeaderboard(members, assignments) {
  // Build lookup map in one O(m) pass
  const byMember = new Map();
  for (const a of assignments) {
    if (!byMember.has(a.memberId)) byMember.set(a.memberId, []);
    byMember.get(a.memberId).push(a);
  }

  return members
    .map(member => {
      const memberAssignments = byMember.get(member.id) || [];
      const totalPoints = memberAssignments.reduce(
        (sum, a) => sum + Number(a.points || 0),
        0
      );
      return { ...member, totalPoints, assignmentCount: memberAssignments.length };
    })
    .sort((a, b) => b.totalPoints - a.totalPoints);
}

// ─── OVERVIEW ─────────────────────────────────────────────────────────────────
// 3 parallel reads (all cached after first call on the page).

export async function loadOverviewData(committeeId = null) {
  const [members, activities, assignments] = await Promise.all([
    loadMembers(committeeId),
    loadActivities(committeeId),
    loadAssignments(committeeId)
  ]);

  const leaderboard = buildLeaderboard(members, assignments);
  const totalPoints = assignments.reduce((sum, a) => sum + Number(a.points || 0), 0);

  const topStudents = leaderboard.length
    ? leaderboard.filter(s =>
        Number(s.totalPoints || 0) >=
        Number(leaderboard[Math.min(2, leaderboard.length - 1)].totalPoints || 0)
      )
    : [];

  return {
    members,
    activities,
    assignments,
    leaderboard,
    totalPoints,
    recentAssignments: assignments.slice(0, 5),
    topStudents
  };
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toDate === "function") return value.toDate().getTime();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}