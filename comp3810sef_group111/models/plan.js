// models/plan.js [shared] money planning.
//
//   Net (all time)      = total income - total expenses - total saved in goals
//   Available to spend  = Net (the same figure, so the app has one definition)
//
// Net is an all-time figure because goal savings are a running total, not dated.
// Mixing a monthly income with an all-time saving would give misleading results.
const transactionModel = require('./transaction');   // all income and expense totals come from here
const budgetModel = require('./budget');             // budgets for the month
const goalModel = require('./goal');                 // goal savings

const money = (n) => goalModel.round2(Number(n) || 0);

// Pure calculations (no database), so they can be tested on their own.
const buildNet = ({ income, expense, goalSaved }) => {
  const net = money(income - expense - goalSaved);
  return { income: money(income), expense: money(expense), goalSaved: money(goalSaved), net };
};

// Savings are blocked when Net is negative, and when the new saving is bigger than Net
// (so one saving cannot push Net below zero). Returns an error message, or null if allowed.
const savingsBlockReason = (net, amount) => {
  if (net < 0) {
    return 'Savings are blocked because your net balance is negative (' + money(net).toFixed(2) +
      '). Add income or reduce spending first.';
  }
  if (amount > net) {
    return 'Savings of ' + money(amount).toFixed(2) + ' are more than your net balance of ' +
      money(net).toFixed(2) + '.';
  }
  return null;
};

// Planned spending for the month. An overall budget (category '') is the limit when it
// exists; otherwise the category budgets are added together.
const plannedSpendOf = (budgets) => {
  const overall = budgets.find((b) => !b.category);
  if (overall) return Number(overall.amount) || 0;
  return budgets.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
};

// Total saved across all of the user's goals. Uses an aggregation pipeline
// ($match, then $group with $sum), the same pattern as the transaction totals.
const totalGoalSaved = async (db, userId) => {
  const rows = await db.collection(goalModel.COLLECTION).aggregate([
    { $match: { userId: String(userId) } },
    { $group: { _id: null, total: { $sum: '$savedAmount' } } },
  ]).toArray();
  return rows.length > 0 ? Number(rows[0].total) || 0 : 0;
};

// Net balance over all time
const getNetBalance = async (db, userId) => {
  const totals = await transactionModel.sumByType(db, String(userId));   // no date range = all time
  const goalSaved = await totalGoalSaved(db, userId);
  return buildNet({ income: totals.income, expense: totals.expense, goalSaved });
};

// Monthly view for the budget dashboard: this month's income, expenses and budgets,
// plus the all-time Net as "available to spend"
const getMonthlyPlan = async (db, userId, month) => {
  const totals = await transactionModel.sumByType(db, String(userId), budgetModel.monthRange(month));
  const budgets = await budgetModel.findBudgets(db, { userId: String(userId), month });
  const net = await getNetBalance(db, userId);
  const plannedSpend = money(plannedSpendOf(budgets));
  const unplanned = money(money(totals.income) - plannedSpend - net.goalSaved);
  return {
    income: money(totals.income),
    expense: money(totals.expense),
    plannedSpend,
    goalSaved: net.goalSaved,
    availableToSpend: net.net,
    unplanned,
    // True when this month's budgets plus goal savings add up to more than this month's income
    overCommitted: unplanned < 0,
  };
};

module.exports = {
  buildNet, savingsBlockReason, plannedSpendOf, totalGoalSaved, getNetBalance, getMonthlyPlan,
};
