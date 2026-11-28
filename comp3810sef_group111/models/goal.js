// models/goal.js  [Member 1]  shared Goal model
// Fields: userId (string), name, targetAmount (> 0), savedAmount (>= 0),
//         deadline ('YYYY-MM-DD', optional), status ('active' or 'completed'), createdAt
const { ObjectId } = require('mongodb');
const COLLECTION = 'goals';
const MAX_AMOUNT = 99999999.99;

const round2 = (n) => Math.round(n * 100) / 100;

const parseMoney = (v) => {
  const s = String(v === undefined || v === null ? '' : v).trim();
  return /^\d+(\.\d{1,2})?$/.test(s) ? Number(s) : NaN;
};

// A real calendar date in YYYY-MM-DD form (rejects 2026-02-30)
const isRealDate = (s) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !isNaN(d) && d.toISOString().slice(0, 10) === s;
};

// Today as YYYY-MM-DD in the server's local time
const todayString = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
};

// Returns a list of error messages (empty list = valid)
const goalErrors = (g) => {
  const errors = [];
  const name = typeof g.name === 'string' ? g.name.trim() : '';
  if (!name) errors.push('Goal name is required');
  else if (name.length > 50) errors.push('Goal name must be at most 50 characters');

  const target = parseMoney(g.targetAmount);
  if (!(target > 0) || target > MAX_AMOUNT) {
    errors.push('Target amount must be a number greater than 0, with at most 2 decimals');
  }
  if (g.deadline && !isRealDate(String(g.deadline).trim())) {
    errors.push('Deadline must be a valid date (YYYY-MM-DD)');
  }
  return errors;
};

// Kept from the first version: returns the first error message, or null if valid
const validateGoal = (g) => goalErrors(g)[0] || null;

// A target cannot be lower than what is already saved (a goal would be over-saved).
// Returns an error message, or null if the target is allowed.
const targetBelowSavedError = (target, saved) => {
  const s = Number(saved) || 0;
  if (Number(target) < s) {
    return 'Target cannot be less than the ' + round2(s).toFixed(2) + ' already saved.';
  }
  return null;
};

// Stored status follows the amounts
const statusFor = (saved, target) => (Number(saved) >= Number(target) ? 'completed' : 'active');

// Adds progress information for display: percent, remaining, statusLabel
//   Completed   = saved >= target
//   Overdue     = deadline passed and not completed
//   In progress = everything else
const withProgress = (g) => {
  const target = Number(g.targetAmount) || 0;
  const saved = Number(g.savedAmount) || 0;
  const percent = target > 0 ? Math.min(100, Math.floor((saved / target) * 100)) : 0;
  const remaining = Math.max(0, round2(target - saved));
  let statusLabel = 'In progress';
  if (target > 0 && saved >= target) statusLabel = 'Completed';
  else if (g.deadline && g.deadline < todayString()) statusLabel = 'Overdue';
  return { ...g, savedAmount: saved, targetAmount: target, percent, remaining, statusLabel };
};

// ---------- database functions ----------
const findGoal = (db, filter) => db.collection(COLLECTION).findOne(filter);
const findGoals = (db, filter) => db.collection(COLLECTION).find(filter).toArray();
const insertGoal = (db, doc) => db.collection(COLLECTION).insertOne({ savedAmount: 0, status: 'active', ...doc, createdAt: new Date() });
const updateGoal = (db, filter, changes) => db.collection(COLLECTION).updateOne(filter, { $set: changes });
const deleteGoal = (db, filter) => db.collection(COLLECTION).deleteOne(filter);

module.exports = {
  ObjectId, COLLECTION, MAX_AMOUNT, round2, parseMoney, isRealDate, todayString,
  goalErrors, validateGoal, statusFor, withProgress, targetBelowSavedError,
  findGoal, findGoals, insertGoal, updateGoal, deleteGoal
};
