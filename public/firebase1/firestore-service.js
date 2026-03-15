import { database } from "./firebase-config.js";
import {
  collection,
  getDocs,
  addDoc,
  query,
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/* =========================
   MEMBERS
========================= */
export async function loadMembers(committeeId = null) {
  const ref = collection(database, "members");
  const q = committeeId
    ? query(ref, where("committeeId", "==", committeeId))
    : ref;

  const snap = await getDocs(q);
  return snap.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => String(a.fullName || "").localeCompare(String(b.fullName || "")));
}

export async function addMember(committeeId, data, createdatabasey) {
  return await addDoc(collection(database, "members"), {
    ...data,
    committeeId,
    createdatabasey,
    createdAt: serverTimestamp()
  });
}

export async function memberPhoneExists(committeeId, phone) {
  const ref = collection(database, "members");
  const q = query(
    ref,
    where("committeeId", "==", committeeId),
    where("phone", "==", phone)
  );

  const snap = await getDocs(q);
  return !snap.empty;
}

/* =========================
   ACTIVITIES
========================= */
export async function loadActivities(committeeId = null) {
  const ref = collection(database, "activities");
  const q = committeeId
    ? query(ref, where("committeeId", "==", committeeId))
    : ref;

  const snap = await getDocs(q);
  return snap.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
}

export async function addActivity(committeeId, data, createdatabasey) {
  return await addDoc(collection(database, "activities"), {
    ...data,
    committeeId,
    createdatabasey,
    createdAt: serverTimestamp()
  });
}

export async function activityCodeExists(committeeId, activityCode) {
  const ref = collection(database, "activities");
  const q = query(
    ref,
    where("committeeId", "==", committeeId),
    where("activityCode", "==", activityCode)
  );

  const snap = await getDocs(q);
  return !snap.empty;
}

/* =========================
   ASSIGNMENTS
========================= */
export async function loadAssignments(committeeId = null) {
  const ref = collection(database, "assignments");
  const q = committeeId
    ? query(ref, where("committeeId", "==", committeeId))
    : ref;

  const snap = await getDocs(q);

  return snap.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => {
      const da = toMillis(a.assignedAt || a.createdAt);
      const databaseb = toMillis(b.assignedAt || b.createdAt);
      return databaseb - da;
    });
}

export async function addAssignment(committeeId, data, assignedatabasey) {
  return await addDoc(collection(database, "assignments"), {
    ...data,
    committeeId,
    assignedatabasey,
    assignedAt: serverTimestamp()
  });
}

/* =========================
   DASHBOARD / LEADERBOARD
========================= */
export async function loadLeaderboard(committeeId = null) {
  const [members, assignments] = await Promise.all([
    loadMembers(committeeId),
    loadAssignments(committeeId)
  ]);

  return members
    .map(member => {
      const memberAssignments = assignments.filter(a => a.memberId === member.id);
      const totalPoints = memberAssignments.reduce(
        (sum, a) => sum + Number(a.points || 0),
        0
      );

      return {
        ...member,
        totalPoints,
        assignmentCount: memberAssignments.length
      };
    })
    .sort((a, b) => b.totalPoints - a.totalPoints);
}

export async function loadOverviewData(committeeId = null) {
  const [members, activities, assignments, leaderboard] = await Promise.all([
    loadMembers(committeeId),
    loadActivities(committeeId),
    loadAssignments(committeeId),
    loadLeaderboard(committeeId)
  ]);

  const totalPoints = assignments.reduce((sum, a) => sum + Number(a.points || 0), 0);

  return {
    members,
    activities,
    assignments,
    leaderboard,
    totalPoints,
    recentAssignments: assignments.slice(0, 5),
    topStudents: leaderboard.slice(0, 3)
  };
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toDate === "function") return value.toDate().getTime();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}