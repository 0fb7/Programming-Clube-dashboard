// /* ============================================================
//    state.js — Shared Application State (Single Source of Truth)
//    All pages read and write from this module via window.AppState
//    Ready for backend integration: replace seedDemo() with API calls
//    ============================================================ */

// (function () {
//   'use strict';

//   /* ----------------------------------------------------------
//      In-memory data store
//      When connecting to MongoDB later, replace these arrays with
//      API calls (fetch/axios) in loadState() below.
//   ---------------------------------------------------------- */
//   const _state = {
//     students:    [],
//     activities:  [],
//     assignments: [],
//   };

//   /* ----------------------------------------------------------
//      Public API
//   ---------------------------------------------------------- */
//   const AppState = {

//     /* ── Getters ── */
//     getStudents()    { return _state.students; },
//     getActivities()  { return _state.activities; },
//     getAssignments() { return _state.assignments; },

//     /* ── Student helpers ── */
//     findStudentById(id) {
//       return _state.students.find(s => s.id == id) || null;
//     },
//     findStudentByPhone(phone) {
//       return _state.students.find(s => s.phone === phone) || null;
//     },
//     addStudent(student) {
//       student.id = Date.now();
//       _state.students.push(student);
//       return student;
//     },

//     /* ── Activity helpers ── */
//     findActivityById(id) {
//       return _state.activities.find(a => a.id == id) || null;
//     },
//     findActivityByAid(aid) {
//       return _state.activities.find(a => a.aid === aid) || null;
//     },
//     addActivity(activity) {
//       activity.id = Date.now();
//       _state.activities.push(activity);
//       return activity;
//     },

//     /* ── Assignment helpers ── */
//     addAssignment(assignment) {
//       assignment.id   = Date.now();
//       assignment.date = new Date().toLocaleDateString('en-GB');
//       _state.assignments.push(assignment);
//       return assignment;
//     },
//     getAssignmentsByStudent(studentId) {
//       return _state.assignments.filter(a => a.studentId == studentId);
//     },

//     /* ── Points helpers ── */
//     getStudentPoints(studentId) {
//       return this.getAssignmentsByStudent(studentId)
//         .reduce((sum, a) => sum + a.pts, 0);
//     },
//     getAllStudentsSorted() {
//       return _state.students
//         .map(s => ({ ...s, pts: this.getStudentPoints(s.id) }))
//         .sort((a, b) => b.pts - a.pts);
//     },

//     /* ── Auth (stub — replace with real API call) ── */
//     authenticate(username, password) {
//       const DEMO = { user: 'admin', pass: 'admin123' };
//       const isEmail = username === 'admin@university.edu';
//       return (isEmail || username === DEMO.user) && password === DEMO.pass;
//     },

//     /* ── Demo seed — remove when connecting to backend ── */
//     seedDemo() {
//       _state.students = [
//         { id: 1, name: 'Ahmed Al-Rashid',   phone: '0501234567', major: 'Computer Science',      level: 'Level 3', gender: 'Male' },
//         { id: 2, name: 'Sara Al-Mutairi',   phone: '0551234567', major: 'Software Engineering',  level: 'Level 4', gender: 'Female' },
//         { id: 3, name: 'Mohammed Al-Harbi', phone: '0561234567', major: 'Information Technology', level: 'Level 2', gender: 'Male' },
//       ];
//       _state.activities = [
//         { id: 10, name: 'Hackathon 2024',  aid: 'ACT-001', pts: 150, cat: 'Competition' },
//         { id: 11, name: 'Python Workshop', aid: 'ACT-002', pts: 50,  cat: 'Workshop' },
//         { id: 12, name: 'Open Source Day', aid: 'ACT-003', pts: 80,  cat: 'Volunteering' },
//       ];
//       _state.assignments = [
//         { id: 100, studentId: 1, activityId: 10, studentName: 'Ahmed Al-Rashid',   activityName: 'Hackathon 2024',  pts: 150, desc: '1st place winner',         date: '10/03/2026' },
//         { id: 101, studentId: 2, activityId: 11, studentName: 'Sara Al-Mutairi',   activityName: 'Python Workshop', pts: 50,  desc: 'Completed all exercises',   date: '11/03/2026' },
//         { id: 102, studentId: 1, activityId: 11, studentName: 'Ahmed Al-Rashid',   activityName: 'Python Workshop', pts: 50,  desc: '',                          date: '11/03/2026' },
//         { id: 103, studentId: 3, activityId: 12, studentName: 'Mohammed Al-Harbi', activityName: 'Open Source Day', pts: 80,  desc: 'Contributed 3 PRs',        date: '12/03/2026' },
//       ];
//     },
//   };

//   /* Seed demo data on load */
//   AppState.seedDemo();

//   /* Expose globally so every page's JS module can access it */
//   window.AppState = AppState;

// })();
