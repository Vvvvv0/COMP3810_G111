// routes/budgets.js [Member 4] budget pages, budget API and monthly summary API
const express = require('express');
const budget = require('../models/budget');

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
    res.render('budgets/dashboard', { title: 'Budget Dashboard', user: req.session, month, budgets });
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

    const error = budget.validateBudget(doc);
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

    const error = budget.validateBudget({ userId, ...changes });
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

    await budget.updateBudget(req.db, { _id: new budget.ObjectId(req.params.id), userId }, changes);
    res.redirect(`/budgets?month=${month}`);
  } catch (err) { next(err); }
});

// Delete (only the owner's budget)
pages.post('/:id/delete', async (req, res, next) => {
  try {
    if (!budget.isValidId(req.params.id)) return res.status(404).send('404 Not Found');
    await budget.deleteBudget(req.db, {
      _id: new budget.ObjectId(req.params.id),
      userId: req.session.userId,
    });
    res.redirect('/budgets');
  } catch (err) { next(err); }
});

// ---------------- REST API (no login; userId is given with each request) ----------------

// GET /api/budgets?userId=...&month=YYYY-MM
api.get('/', async (req, res, next) => {
  try {
    const { userId, month } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    const filter = { userId };
    if (month) filter.month = month;
    res.json(await budget.findBudgets(req.db, filter));
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
    const error = budget.validateBudget(doc);
    if (error) return res.status(400).json({ error });
    if (await budget.findDuplicate(req.db, doc)) return res.status(409).json({ error: 'Duplicate budget.' });

    const result = await budget.insertBudget(req.db, doc);
    res.status(201).json({ _id: result.insertedId, ...doc });
  } catch (err) { next(err); }
});

// PUT /api/budgets/:id   body: { userId, month, category, amount }
api.put('/:id', async (req, res, next) => {
  try {
    if (!budget.isValidId(req.params.id)) return res.status(404).json({ error: 'Invalid id' });
    const userId = req.body.userId || req.query.userId;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const changes = {
      month: req.body.month,
      category: budget.normalizeCategory(req.body.category),
      amount: Number(req.body.amount),
    };
    const error = budget.validateBudget({ userId, ...changes });
    if (error) return res.status(400).json({ error });

    const dup = await budget.findDuplicate(req.db, { userId, month: changes.month, category: changes.category });
    if (dup && String(dup._id) !== req.params.id) return res.status(409).json({ error: 'Duplicate budget.' });

    const result = await budget.updateBudget(
      req.db,
      { _id: new budget.ObjectId(req.params.id), userId },
      changes
    );
    if (result.matchedCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// DELETE /api/budgets/:id?userId=...
api.delete('/:id', async (req, res, next) => {
  try {
    if (!budget.isValidId(req.params.id)) return res.status(404).json({ error: 'Invalid id' });
    const userId = req.body.userId || req.query.userId;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const result = await budget.deleteBudget(req.db, { _id: new budget.ObjectId(req.params.id), userId });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ---------------- Monthly summary API ----------------

// GET /api/reports/summary?userId=...&month=YYYY-MM
reports.get('/summary', async (req, res, next) => {
  try {
    const { userId, month } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    if (!budget.isValidMonth(month)) return res.status(400).json({ error: 'month must be YYYY-MM (01 to 12)' });

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
      budgets: rows,
    });
  } catch (err) { next(err); }
});

module.exports = { pages, api, reports };
