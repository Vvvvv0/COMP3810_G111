// models/budget.js [Member 4] shared Budget model
// Fields: userId (string), month ('YYYY-MM'), category (string, '' = overall budget),
//         amount (> 0), createdAt
const { ObjectId } = require('mongodb');
const transactionModel = require('./transaction');   // Member 3: all spending is calculated there
const COLLECTION = 'budgets';

// Returns an error message, or null if the budget is valid
const validateBudget = (b) => {
  if (!b.userId) return 'userId is required.';
  if (!isValidMonth(b.month)) return 'Month must be YYYY-MM (01 to 12).';
  if (!(Number(b.amount) > 0)) return 'Amount must be greater than 0.';
  return null;
};

// A blank category is stored as '' so that an overall budget is always the same value
const normalizeCategory = (category) => (category && category.trim()) || '';

// True for a month such as 2026-11 (month 01 to 12)
const isValidMonth = (m) => typeof m === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);

// True if the text is a 24-character MongoDB id (same check as the goals routes)
const isValidId = (id) => typeof id === 'string' && /^[a-f\d]{24}$/i.test(id);

// First and last day of 'YYYY-MM' as 'YYYY-MM-DD' strings
const monthRange = (month) => {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return {
    from: `${month}-01`,
    to: `${month}-${String(lastDay).padStart(2, '0')}`,
  };
};

// Sum of the category budgets (not the overall one) in a list
const categoryTotal = (list) => list
  .filter((b) => b.category)
  .reduce((sum, b) => sum + (Number(b.amount) || 0), 0);

const money = (n) => (Number(n) || 0).toFixed(2);

// Overall-budget rule for one month. An overall budget must exist before category budgets,
// and the category budgets cannot add up to more than the overall budget.
// selfId is the budget being edited (left out of the check). Returns an error or null.
const overallRuleError = async (db, { userId, month, category, amount }, selfId = null) => {
  const others = (await findBudgets(db, { userId: String(userId), month }))
    .filter((b) => String(b._id) !== String(selfId));
  const overall = others.find((b) => !b.category);
  const categories = categoryTotal(others);
  const value = Number(amount) || 0;

  if (!category) {
    if (categories > value) {
      return 'Category budgets would total ' + money(total) + ', which is more than the overall budget of ' + money(overall.amount) + '.';
    }
    return null;
  }
  if (!overall) return 'Set an overall budget for this month first.';
  const total = categories + value;
  if (total > Number(overall.amount)) {
    return 'Category budgets cannot exceed the toal amount of the overall budget of ' +
      money(overall.amount) + '.';
  }
  return null;
};

// An overall budget cannot be deleted while category budgets exist for its month
const deleteRuleError = async (db, budgetDoc) => {
  if (budgetDoc.category) return null;
  const others = await findBudgets(db, { userId: String(budgetDoc.userId), month: budgetDoc.month });
  if (others.some((b) => b.category)) {
    return 'Delete the category budgets for this month before removing the overall budget.';
  }
  return null;
};

// ---------- Data-access functions (no req or res here) ----------
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

// Duplicate check: same user, month and category (an overall budget counts as '')
const findDuplicate = (db, { userId, month, category }) =>
  db.collection(COLLECTION).findOne({
    userId,
    month,
    category: normalizeCategory(category),
  });

// Spending for one month, from Member 3's helper.
// Returns { overall, byCategory }.
const getSpent = async (db, userId, month) => {
  const rows = await transactionModel.sumExpenseByCategory(db, String(userId), monthRange(month));

  const byCategory = {};
  let overall = 0;
  rows.forEach((r) => {
    const amt = Number(r.total) || 0;
    byCategory[r.category] = amt;
    overall += amt;
  });
  return { overall, byCategory };
};

// The ONE budget usage calculation: spent, remaining and usage % for each budget of the month
const getBudgetUsage = async (db, userId, month) => {
  const budgets = await findBudgets(db, { userId: String(userId), month });
  const spent = await getSpent(db, userId, month);

  return budgets.map((bg) => {
    const amount = Number(bg.amount) || 0;
    const spentAmount = bg.category ? spent.byCategory[bg.category] || 0 : spent.overall;
    const remaining = amount - spentAmount;
    const usagePct = amount > 0 ? Math.round((spentAmount / amount) * 100) : 0;
    return {
      ...bg,
      spentAmount,
      remaining,
      usagePct,
      warning: usagePct >= 80,
    };
  });
};

module.exports = {
  ObjectId,
  COLLECTION,
  isValidId,
  isValidMonth,
  validateBudget,
  normalizeCategory,
  monthRange,
  findBudgets,
  findBudget,
  insertBudget,
  updateBudget,
  deleteBudget,
  findDuplicate,
  overallRuleError,
  deleteRuleError,
  getSpent,
  getBudgetUsage,
};

