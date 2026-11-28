// routes/budgets.js [Member 4] budget pages, budget API and monthly summary API
const express = require('express');
const budget = require('../models/budget');
const plan = require('../models/plan');            // monthly plan: income, budgets, goal savings

const pages = express.Router();    // mounted at /budgets (login checked in server.js)
const api = express.Router();      // mounted at /api/budgets (no login, userId given)
const reports = express.Router();  // mounted at /api/reports

// The month shown when the address has none, e.g. 2026-11
const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const DUPLICATE_MESSAGE = 'A budget for this month and category already exists.';

// ---------------- Web pages (logged-in user only) ----------------

// Budget list for the selected month
pages.get('/', async (req, res, next) => {
  try {
    const month = req.query.month || currentMonth();
    const budgets = await budget.getBudgetUsage(req.db, req.session.userId, month);
    res.render('budgets/list', { title: 'Budgets', user: req.session, month, budgets, error: null });
  } catch (err) { next(err); }
});

// Budget usage overview
pages.get('/dashboard', async (req, res, next) => {
  try {
    const month = req.query.month || currentMonth();
    const budgets = await budget.getBudgetUsage(req.db, req.session.userId, month);
    const monthlyPlan = await plan.getMonthlyPlan(req.db, req.session.userId, month);
    const isPastMonth = month < currentMonth();
    res.render('budgets/dashboard', { title: 'Budget Dashboard', user: req.session, month, budgets, monthlyPlan, isPastMonth });
  } catch (err) { next(err); }
});

// Add form
pages.get('/new', (req, res) => {
  res.render('budgets/form', {
    title: 'Add Budget',
    user: req.session,
    values: { month: currentMonth(), category: '', amount: '' },
    errors: null,
    editing: false,
  });
});

// Create
pages.post('/', async (req, res, next) => {
  try {
    const userId = req.session.userId;
    const { month, category, amount } = req.body;
    const doc = { userId, month, category: budget.normalizeCategory(category), amount: Number(amount) };

    const error = budget.validateBudget(doc).join(' ');
    if (error) {
      return res.render('budgets/form', {
        title: 'Add Budget', user: req.session, values: req.body, errors: error, editing: false,
      });
    }
    if (await budget.findDuplicate(req.db, doc)) {
      return res.render('budgets/form', {
        title: 'Add Budget', user: req.session, values: req.body, errors: DUPLICATE_MESSAGE, editing: false,
      });
    }
    const ruleError = await budget.overallRuleError(req.db, doc);
    if (ruleError) {
      return res.render('budgets/form', {
        title: 'Add Budget', user: req.session, values: req.body, errors: ruleError, editing: false,
      });
    }

    await budget.insertBudget(req.db, doc);
    res.redirect(`/budgets?month=${month}`);
  } catch (err) { next(err); }
});

// Edit form (only the owner's budget)
pages.get('/:id/edit', async (req, res, next) => {
  try {
    if (!budget.isValidId(req.params.id)) return res.status(404).send('404 Not Found');
    const found = await budget.findBudget(req.db, {
      _id: new budget.ObjectId(req.params.id),
      userId: req.session.userId,
    });
    if (!found) return res.status(404).send('404 Not Found');

    res.render('budgets/form', {
      title: 'Edit Budget',
      user: req.session,
      values: { _id: String(found._id), month: found.month, category: found.category, amount: found.amount },
      errors: null,
      editing: true,
    });
  } catch (err) { next(err); }
});

// Update (only the owner's budget)
pages.post('/:id/update', async (req, res, next) => {
  try {
    if (!budget.isValidId(req.params.id)) return res.status(404).send('404 Not Found');
    const userId = req.session.userId;
    const { month, category, amount } = req.body;
    const changes = { month, category: budget.normalizeCategory(category), amount: Number(amount) };

    const error = budget.validateBudget({ userId, ...changes }).join(' ');
    if (error) {
      return res.render('budgets/form', {
        title: 'Edit Budget', user: req.session, values: req.body, errors: error, editing: true,
      });
    }

    const dup = await budget.findDuplicate(req.db, { userId, month, category: changes.category });
    if (dup && String(dup._id) !== req.params.id) {
      return res.render('budgets/form', {
        title: 'Edit Budget', user: req.session, values: req.body, errors: DUPLICATE_MESSAGE, editing: true,
      });
    }
    const ruleError = await budget.overallRuleError(req.db, { userId, ...changes }, req.params.id);
    if (ruleError) {
      return res.render('budgets/form', {
        title: 'Edit Budget', user: req.session, values: req.body, errors: ruleError, editing: true,
      });
    }

    await budget.updateBudget(req.db, { _id: new budget.ObjectId(req.params.id), userId }, changes);
    res.redirect(`/budgets?month=${month}`);
  } catch (err) { next(err); }
});

// Delete (only the owner's budget)
pages.post('/:id/delete', async (req, res, next) => {
  try {
    if (!budget.isValidId(req.params.id)) return res.status(404).send('404 Not Found');
    const filter = { _id: new budget.ObjectId(req.params.id), userId: req.session.userId };
    const found = await budget.findBudget(req.db, filter);
    const ruleError = found && await budget.deleteRuleError(req.db, found);
    if (ruleError) {
      const budgets = await budget.getBudgetUsage(req.db, req.session.userId, found.month);
      return res.render('budgets/list', { title: 'Budgets', user: req.session, month: found.month, budgets, error: ruleError });
    }
    await budget.deleteBudget(req.db, filter);
    res.redirect('/budgets');
  } catch (err) { next(err); }
});

// ---------------- REST API (no login; userId is given with each request) ----------------

// Every API error is a list, so all the problems in one request can be returned together
const fail = (res, status, errors) => res.status(status).json({ error: [].concat(errors) });

// Checks the budget fields and returns every problem found (empty list if none)
const fieldErrors = (doc) => {
  const errors = [];
  if (!doc.userId) errors.push('userId is required.');
  if (!budget.isValidMonth(doc.month)) errors.push('Month must be YYYY-MM (01 to 12).');
  if (!(Number(doc.amount) > 0)) errors.push('Amount must be greater than 0.');
  return errors;
};

// GET /api/budgets?userId=...&month=YYYY-MM
// With a month, each budget also has spentAmount, remaining, usagePct and warning.
api.get('/', async (req, res, next) => {
  try {
    const { userId, month } = req.query;
    if (!userId) return fail(res, 400, 'userId is required.');
    if (month && !budget.isValidMonth(month)) return fail(res, 400, 'Month must be YYYY-MM (01 to 12).');

    const data = month
      ? await budget.getBudgetUsage(req.db, userId, month)
      : await budget.findBudgets(req.db, { userId });
    res.status(200).json({ count: data.length, filters: { month: month || '' }, data });
  } catch (err) { next(err); }
});

// POST /api/budgets   body: { userId, month, category, amount }
api.post('/', async (req, res, next) => {
  try {
    const doc = {
      userId: req.body.userId,
      month: req.body.month,
      category: budget.normalizeCategory(req.body.category),
      amount: Number(req.body.amount),
    };
    const errors = fieldErrors(doc);
    if (errors.length > 0) return fail(res, 400, errors);
    if (await budget.findDuplicate(req.db, doc)) return fail(res, 409, DUPLICATE_MESSAGE);
    const ruleError = await budget.overallRuleError(req.db, doc);
    if (ruleError) return fail(res, 400, ruleError);

    const result = await budget.insertBudget(req.db, doc);
    res.status(201).json({ message: 'Budget created', data: { _id: result.insertedId, ...doc } });
  } catch (err) { next(err); }
});

// PUT /api/budgets/:id   body: { userId, month, category, amount }
api.put('/:id', async (req, res, next) => {
  try {
    if (!budget.isValidId(req.params.id)) return fail(res, 400, 'Invalid budget id.');
    const userId = req.body.userId || req.query.userId;
    const changes = {
      month: req.body.month,
      category: budget.normalizeCategory(req.body.category),
      amount: Number(req.body.amount),
    };
    const errors = fieldErrors({ userId, ...changes });
    if (errors.length > 0) return fail(res, 400, errors);

    const existing = await budget.findBudget(req.db, { _id: new budget.ObjectId(req.params.id), userId });
    if (!existing) return fail(res, 404, 'Budget not found.');
    const dup = await budget.findDuplicate(req.db, { userId, month: changes.month, category: changes.category });
    if (dup && String(dup._id) !== req.params.id) return fail(res, 409, DUPLICATE_MESSAGE);
    const ruleError = await budget.overallRuleError(req.db, { userId, ...changes }, req.params.id);
    if (ruleError) return fail(res, 400, ruleError);

    await budget.updateBudget(req.db, { _id: new budget.ObjectId(req.params.id), userId }, changes);
    const updated = await budget.findBudget(req.db, { _id: new budget.ObjectId(req.params.id), userId });
    res.status(200).json({ message: 'Budget updated', data: updated });
  } catch (err) { next(err); }
});

// DELETE /api/budgets/:id?userId=...
api.delete('/:id', async (req, res, next) => {
  try {
    if (!budget.isValidId(req.params.id)) return fail(res, 400, 'Invalid budget id.');
    const userId = req.body.userId || req.query.userId;
    if (!userId) return fail(res, 400, 'userId is required.');

    const filter = { _id: new budget.ObjectId(req.params.id), userId };
    const found = await budget.findBudget(req.db, filter);
    const ruleError = found && await budget.deleteRuleError(req.db, found);
    if (ruleError) return fail(res, 400, ruleError);

    const result = await budget.deleteBudget(req.db, filter);
    if (result.deletedCount === 0) return fail(res, 404, 'Budget not found.');
    res.status(200).json({ message: 'Budget deleted', data: { _id: req.params.id } });
  } catch (err) { next(err); }
});

// ---------------- Monthly summary API ----------------

// GET /api/reports/summary?userId=...&month=YYYY-MM
reports.get('/summary', async (req, res, next) => {
  try {
    const { userId, month } = req.query;
    if (!userId) return fail(res, 400, 'userId is required.');
    if (!budget.isValidMonth(month)) return fail(res, 400, 'Month must be YYYY-MM (01 to 12).');

    const rows = await budget.getBudgetUsage(req.db, userId, month);
    const totalBudget = rows.reduce((s, b) => s + (Number(b.amount) || 0), 0);
    const totalSpent = rows.reduce((s, b) => s + (Number(b.spentAmount) || 0), 0);

    res.json({
      userId,
      month,
      totalBudget,
      totalSpent,
      remaining: totalBudget - totalSpent,
      usagePct: totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0,
      plan: await plan.getMonthlyPlan(req.db, userId, month),
      budgets: rows,
    });
  } catch (err) { next(err); }
});

module.exports = { pages, api, reports };

