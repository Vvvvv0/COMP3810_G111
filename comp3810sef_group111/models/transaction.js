// models/transaction.js  [Member 3]  shared Transaction model
// Fields: userId (string), type ('income' or 'expense'), amount (> 0), category, date (Date), note, createdAt
// Filtering, paging and totals are done in JavaScript on the user's own transactions,
// using only find().toArray(), insertOne, updateOne with $set and deleteOne (Lecture 5).
const { ObjectId } = require('mongodb');
const COLLECTION = 'transactions';
const DAY_MS = 24 * 60 * 60 * 1000;

// Returns an error message, or null if the record is valid
const validateTransaction = (t) => {
  if (t.type !== 'income' && t.type !== 'expense') return 'type must be income or expense';
  if (!(Number(t.amount) > 0)) return 'amount must be greater than 0';
  if (!t.category) return 'category is required';
  return null;
};

const CATEGORIES = [
  'food', 'transportation', 'shopping', 'entertainment',
  'housing', 'health', 'education', 'salary', 'other'
];

// All transactions of one user (the only database query used for reading)
const loadTransactions = (db, userId) =>
  db.collection(COLLECTION).find({ userId: String(userId) }).toArray();

// Keeps the transactions that match the query: type, category, from, to, keyword.
// from and to are 'YYYY-MM-DD'; to includes the whole day. keyword is a
// case-insensitive text match on the note.
const matching = (list, q = {}) => {
  const from = q.from ? new Date(q.from).getTime() : null;
  const toEnd = q.to ? new Date(q.to).getTime() + DAY_MS : null;
  const word = q.keyword ? String(q.keyword).toLowerCase() : '';
  return list.filter((t) => {
    const time = new Date(t.date).getTime();
    if (q.type && t.type !== q.type) return false;
    if (q.category && t.category !== q.category) return false;
    if (from !== null && time < from) return false;
    if (toEnd !== null && time >= toEnd) return false;
    if (word && !String(t.note || '').toLowerCase().includes(word)) return false;
    return true;
  });
};

// Newest first (a copy, so the input list is not changed)
const newestFirst = (list) =>
  list.slice().sort((a, b) => new Date(b.date) - new Date(a.date));

// Income and expense totals for a list
const summarize = (list) => list.reduce((acc, t) => {
  acc[t.type] = (acc[t.type] || 0) + (Number(t.amount) || 0);
  return acc;
}, { income: 0, expense: 0 });

// Used by plan.js (opts = { from, to }) and by the transactions page (opts = query)
const sumByType = async (db, userId, opts = {}) =>
  summarize(matching(await loadTransactions(db, userId), opts));

// Expense totals per category, largest first. Same shape as before: [{ category, total }]
const sumExpenseByCategory = async (db, userId, opts = {}) => {
  const totals = {};
  matching(await loadTransactions(db, userId), { ...opts, type: 'expense' })
    .forEach((t) => {
      totals[t.category] = (totals[t.category] || 0) + (Number(t.amount) || 0);
    });

  return Object.keys(totals)
    .map((category) => ({ category, total: totals[category] }))
    .sort((a, b) => b.total - a.total);

};

const findTransactionById = (db, id) => {
  if (!ObjectId.isValid(id)) return null;
  return db.collection(COLLECTION).findOne({ _id: new ObjectId(id) });
};

const insertTransaction = (db, doc) => db.collection(COLLECTION).insertOne({ ...doc, createdAt: new Date() });
const updateTransaction = (db, filter, changes) => db.collection(COLLECTION).updateOne(filter, { $set: changes });
const deleteTransaction = (db, filter) => db.collection(COLLECTION).deleteOne(filter);

module.exports = {
  ObjectId, COLLECTION, CATEGORIES,
  validateTransaction, loadTransactions, matching, newestFirst, summarize,
  findTransactionById, insertTransaction, updateTransaction, deleteTransaction,
  sumByType, sumExpenseByCategory
};