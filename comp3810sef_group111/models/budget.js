// models/budget.js [Member 4] shared Budget model
// Fields: userId (string), month ('YYYY-MM'), category (string, '' = overall budget),
//         amount (> 0), createdAt
const { ObjectId } = require('mongodb');
const COLLECTION = 'budgets';

//Validation: returns an error message, or null if valid 
const validateBudget = (b) => {
  if (!b.userId) return 'userId is required';
  if (!b.month || !/^\d{4}-\d{2}$/.test(b.month)) return 'month must be YYYY-MM';
  if (!(Number(b.amount) > 0)) return 'amount must be greater than 0';
  return null;
};

// Normalize a blank category to '' so an overall budget is stored consistently.
const normalizeCategory = (category) => (category && category.trim()) || '';

//Data-access functions (driver layer, no req/res)
const findBudgets = (db, filter) =>
  db.collection(COLLECTION).find(filter).toArray();

const findBudget = (db, filter) =>
  db.collection(COLLECTION).findOne(filter);

const insertBudget = (db, doc) =>
  db.collection(COLLECTION).insertOne({ ...doc, createdAt: new Date() });

const updateBudget = (db, filter, changes) =>
  db.collection(COLLECTION).updateOne(filter, { $set: changes });

const deleteBudget = (db, filter) =>
  db.collection(COLLECTION).deleteOne(filter);

// Duplicate check: same user + month + category (overall budget counts as '')
const findDuplicate = (db, { userId, month, category }) =>
  db.collection(COLLECTION).findOne({
    userId,
    month,
    category: normalizeCategory(category),
  });

// TODO(Member 3): once his getSpentByCategory(db, userId, month) is exported from
// models/transaction.js (returning { overall, byCategory }), replace the fallback
// below with his function. Do not keep a separate calculation after that.
const getSpent = async (db, userId, month) => {
  const txs = await db.collection('transactions').find({
    userId,
    type: 'expense',
    date: { $regex: `^${month}` },
  }).toArray();

  const byCategory = {};
  let overall = 0;
  txs.forEach((t) => {
    const amt = Number(t.amount) || 0;
    overall += amt;
    byCategory[t.category] = (byCategory[t.category] || 0) + amt;
  });
  return { overall, byCategory };
};

//Budget usage: spent amount, remaining amount, usage percentage
const getBudgetUsage = async (db, userId, month) => {
  const budgets = await findBudgets(db, { userId, month });
  const spent = await getSpent(db, userId, month);

  return budgets.map((bg) => {
    const amount = Number(bg.amount) || 0;
    const spentAmount = bg.category
      ? spent.byCategory[bg.category] || 0
      : spent.overall || 0;
    const remaining = amount - spentAmount;
    const usagePct = amount > 0 ? Math.round((spentAmount / amount) * 100) : 0;
    return {
      ...bg,
      spentAmount,
      remaining,
      usagePct,
      warning: usagePct >= 80, // optional 80% warning
    };
  });
};

module.exports = {
  ObjectId,
  COLLECTION,
  validateBudget,
  normalizeCategory,
  findBudgets,
  findBudget,
  insertBudget,
  updateBudget,
  deleteBudget,
  findDuplicate,
  getSpent,
  getBudgetUsage,
};
