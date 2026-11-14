// routes/budgets.js [Member 4] pages + API
const express = require('express');
const pages = express.Router();
const api = express.Router();

const budget = require('../models/budget');

const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const isValidId = (id) => {
  try {
    return !!new budget.ObjectId(id);
  } catch (e) {
    return false;
  }
};

// Web pages (mounted under /budgets, protected by requireLogin)

// Budget list page for the selected month (own records only)
pages.get('/', async (req, res) => {
  const userId = req.session.userId;
  const month = req.query.month || currentMonth();
  const budgets = await budget.getBudgetUsage(req.db, userId, month);
  res.render('budgets/list', {
    title: 'Budgets',
    user: req.session,
    month,
    budgets,
    error: null,
  });
});

// Dashboard: budget usage overview
pages.get('/dashboard', async (req, res) => {
  const userId = req.session.userId;
  const month = req.query.month || currentMonth();
  const budgets = await budget.getBudgetUsage(req.db, userId, month);
  res.render('budgets/dashboard', {
    title: 'Budget Dashboard',
    user: req.session,
    month,
    budgets,
  });
});

// Add budget form
pages.get('/new', (req, res) => {
  res.render('budgets/form', {
    title: 'Add Budget',
    user: req.session,
    values: { month: currentMonth(), category: '', amount: '' },
    errors: null,
    editing: false,
  });
});

// Create budget
pages.post('/', async (req, res) => {
  const userId = req.session.userId;
  const { month, category, amount } = req.body;
  const doc = {
    userId,
    month,
    category: budget.normalizeCategory(category),
    amount: Number(amount),
  };

  const error = budget.validateBudget(doc);
  if (error) {
    return res.render('budgets/form', {
      title: 'Add Budget',
      user: req.session,
      values: req.body,
      errors: error,
      editing: false,
    });
  }

  const dup = await budget.findDuplicate(req.db, doc);
  if (dup) {
    return res.render('budgets/form', {
      title: 'Add Budget',
      user: req.session,
      values: req.body,
      errors: 'A budget for this month and category already exists.',
      editing: false,
    });
  }

  await budget.insertBudget(req.db, doc);
  res.redirect(`/budgets?month=${month}`);
});

// Edit budget form
pages.get('/:id/edit', async (req, res) => {
  if (!isValidId(req.params.id)) return res.status(404).send('404 Not Found');
  const found = await budget.findBudget(req.db, {
    _id: new budget.ObjectId(req.params.id),
    userId: req.session.userId,
  });
  if (!found) return res.status(404).send('404 Not Found');

  res.render('budgets/form', {
    title: 'Edit Budget',
    user: req.session,
    values: {
      _id: String(found._id),
      month: found.month,
      category: found.category,
      amount: found.amount,
    },
    errors: null,
    editing: true,
  });
});

// Update budget
pages.post('/:id/update', async (req, res) => {
  if (!isValidId(req.params.id)) return res.status(404).send('404 Not Found');
  const userId = req.session.userId;
  const { month, category, amount } = req.body;
  const changes = {
    month,
    category: budget.normalizeCategory(category),
    amount: Number(amount),
  };

  const error = budget.validateBudget({ userId, ...changes });
  if (error) {
    return res.render('budgets/form', {
      title: 'Edit Budget',
      user: req.session,
      values: req.body,
      errors: error,
      editing: true,
    });
  }

  const filter = { _id: new budget.ObjectId(req.params.id), userId };
  const dup = await budget.findDuplicate(req.db, { userId, month, category });
  if (dup && String(dup._id) !== req.params.id) {
    return res.render('budgets/form', {
      title: 'Edit Budget',
      user: req.session,
      values: req.body,
      errors: 'A budget for this month and category already exists.',
      editing: true,
    });
  }

  await budget.updateBudget(req.db, filter, changes);
  res.redirect(`/budgets?month=${month}`);
});

// Delete budget (ownership query includes both _id and userId)
pages.post('/:id/delete', async (req, res) => {
  if (!isValidId(req.params.id)) return res.status(404).send('404 Not Found');
  await budget.deleteBudget(req.db, {
    _id: new budget.ObjectId(req.params.id),
    userId: req.session.userId,
  });
  res.redirect('/budgets');
});

// RESTful APIs: budget CRUD (mounted under /api/budgets, no login per spec)
// GET /api/budgets?userId=...&month=YYYY-MM
api.get('/', async (req, res) => {
  const { userId, month } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId is required' });
  const filter = { userId };
  if (month) filter.month = month;
  const budgets = await budget.findBudgets(req.db, filter);
  res.json(budgets);
});

// POST /api/budgets
api.post('/', async (req, res) => {
  const doc = {
    userId: req.body.userId,
    month: req.body.month,
    category: budget.normalizeCategory(req.body.category),
    amount: Number(req.body.amount),
  };
  const error = budget.validateBudget(doc);
  if (error) return res.status(400).json({ error });

  const dup = await budget.findDuplicate(req.db, doc);
  if (dup) return res.status(409).json({ error: 'Duplicate budget.' });

  const result = await budget.insertBudget(req.db, doc);
  res.status(201).json({ _id: result.insertedId, ...doc });
});

// PUT /api/budgets/:id
api.put('/:id', async (req, res) => {
  if (!isValidId(req.params.id)) return res.status(404).json({ error: 'Invalid id' });
  const filter = {
    _id: new budget.ObjectId(req.params.id),
    userId: req.body.userId || req.query.userId,
  };
  const changes = {
    month: req.body.month,
    category: budget.normalizeCategory(req.body.category),
    amount: Number(req.body.amount),
  };
  const error = budget.validateBudget({ userId: filter.userId, ...changes });
  if (error) return res.status(400).json({ error });

  const result = await budget.updateBudget(req.db, filter, changes);
  if (result.matchedCount === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

// DELETE /api/budgets/:id
api.delete('/:id', async (req, res) => {
  if (!isValidId(req.params.id)) return res.status(404).json({ error: 'Invalid id' });
  const filter = {
    _id: new budget.ObjectId(req.params.id),
    userId: req.body.userId || req.query.userId,
  };
  const result = await budget.deleteBudget(req.db, filter);
  if (result.deletedCount === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

module.exports = { pages, api };
