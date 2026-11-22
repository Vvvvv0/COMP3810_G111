// routes/goals.js  [Member 1]
// Saving goals: web pages (list, add, edit, delete, add savings) + REST API.
const express = require('express');
const goal = require('../models/goal');
const pages = express.Router();
const api = express.Router();

// ---------------- Small helpers used by the pages and the API ----------------

// Short messages shown at the top of the list after an action.
// The address only carries a code, e.g. /goals?msg=added
const MESSAGES = {
  added: 'Goal added.',
  updated: 'Goal updated.',
  deleted: 'Goal deleted.',
  saved: 'Savings added.',
  completed: 'Congratulations! You reached this goal.'
};
const messageFor = (code) =>
  typeof code === 'string' && Object.prototype.hasOwnProperty.call(MESSAGES, code) ? MESSAGES[code] : '';

const text = (v) => (typeof v === 'string' ? v.trim() : '');
const moneyText = (v) => (typeof v === 'number' ? String(v) : text(v));
const formValues = (body = {}) => ({
  name: text(body.name),
  targetAmount: moneyText(body.targetAmount),
  deadline: text(body.deadline)
});

const isId = (v) => typeof v === 'string' && /^[a-f\d]{24}$/i.test(v);   // 24-character id
const validAmount = (a) => a > 0 && a <= goal.MAX_AMOUNT;

// Save the edited fields. The status follows the new target.
const saveEdit = (db, filter, found, values) => {
  const targetAmount = goal.parseMoney(values.targetAmount);
  return goal.updateGoal(db, filter, {
    name: values.name,
    targetAmount,
    deadline: values.deadline || null,
    status: goal.statusFor(found.savedAmount, targetAmount)
  });
};

// Add savings: new saved amount = old saved amount + amount. Tells if the target was just reached.
const saveSavings = async (db, filter, found, amount) => {
  const before = Number(found.savedAmount) || 0;
  const saved = goal.round2(before + amount);
  await goal.updateGoal(db, filter, { savedAmount: saved, status: goal.statusFor(saved, found.targetAmount) });
  return { reached: before < found.targetAmount && saved >= found.targetAmount };
};

// ---------------- Web pages (mounted at /goals, login required) ----------------

// Show the add form (used for the empty form and for the form with errors)
const renderAddForm = (req, res, status, values, errors) => {
  res.status(status).render('goals/form', {
    title: 'Add Goal', user: req.session,
    heading: 'Add Saving Goal', submitLabel: 'Add goal', action: '/goals',
    values, errors
  });
};

// Show the list page (used by the list route and when add-savings has an error)
const renderList = async (req, res, status, errors, message) => {
  const goals = await goal.findGoals(req.db, { userId: req.session.userId });
  goals.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));   // newest first
  res.status(status).render('goals/list', {
    title: 'My Goals', user: req.session, goals, errors, message
  });
};

// A goal can only be changed by its owner: the id AND the user must match.
// Returns null when the id in the address is not a 24-character id.
const ownedFilter = (req) => {
  if (!isId(req.params.id)) return null;
  return { _id: new goal.ObjectId(req.params.id), userId: req.session.userId };
};

// Show the edit form (used for the filled form and for the form with errors)
const renderEditForm = (req, res, status, values, errors) => {
  res.status(status).render('goals/form', {
    title: 'Edit Goal', user: req.session,
    heading: 'Edit Saving Goal', submitLabel: 'Save changes',
    action: '/goals/' + req.params.id + '/update',
    values, errors
  });
};

// List the logged-in user's goals
pages.get('/', async (req, res, next) => {
  try {
    await renderList(req, res, 200, [], messageFor(req.query.msg));
  } catch (err) { next(err); }
});

// ---- Add a goal ----

pages.get('/new', (req, res) => {
  renderAddForm(req, res, 200, { name: '', targetAmount: '', deadline: '' }, []);
});

pages.post('/', async (req, res, next) => {
  try {
    const values = formValues(req.body);
    const errors = goal.goalErrors(values);
    if (errors.length > 0) {
      return renderAddForm(req, res, 400, values, errors);   // keep what the user typed
    }
    await goal.insertGoal(req.db, {
      userId: req.session.userId,
      name: values.name,
      targetAmount: goal.parseMoney(values.targetAmount),
      deadline: values.deadline || null
    });
    res.redirect('/goals?msg=added');
  } catch (err) { next(err); }
});

// ---- Edit a goal (the saved amount only changes through "Add savings") ----

pages.get('/:id/edit', async (req, res, next) => {
  try {
    const filter = ownedFilter(req);
    if (!filter) return next();                      // bad id -> 404
    const found = await goal.findGoal(req.db, filter);
    if (!found) return next();                       // not found / not yours -> 404
    renderEditForm(req, res, 200,
      { name: found.name, targetAmount: found.targetAmount, deadline: found.deadline || '' }, []);
  } catch (err) { next(err); }
});

pages.post('/:id/update', async (req, res, next) => {
  try {
    const filter = ownedFilter(req);
    if (!filter) return next();
    const found = await goal.findGoal(req.db, filter);
    if (!found) return next();

    const values = formValues(req.body);
    const errors = goal.goalErrors(values);
    if (errors.length > 0) return renderEditForm(req, res, 400, values, errors);

    await saveEdit(req.db, filter, found, values);
    res.redirect('/goals?msg=updated');
  } catch (err) { next(err); }
});

// ---- Delete a goal ----

pages.post('/:id/delete', async (req, res, next) => {
  try {
    const filter = ownedFilter(req);
    if (!filter) return next();
    const result = await goal.deleteGoal(req.db, filter);
    if (result.deletedCount === 0) return next();    // nothing deleted -> 404
    res.redirect('/goals?msg=deleted');
  } catch (err) { next(err); }
});

// ---- Add savings ----

pages.post('/:id/save', async (req, res, next) => {
  try {
    const filter = ownedFilter(req);
    if (!filter) return next();
    const found = await goal.findGoal(req.db, filter);
    if (!found) return next();

    const amount = goal.parseMoney(req.body && req.body.amount);
    if (!validAmount(amount)) {
      return renderList(req, res, 400,
        ['Savings for "' + found.name + '" must be a number greater than 0, with at most 2 decimals'], '');
    }
    const { reached } = await saveSavings(req.db, filter, found, amount);
    res.redirect('/goals?msg=' + (reached ? 'completed' : 'saved'));
  } catch (err) { next(err); }
});

// ---------------- REST API (mounted at /api/goals, no login needed) ----------------
// The owner is named with userId: in the query string (GET, DELETE) or in the JSON body (POST, PUT).
//   GET    /api/goals?userId=...                 list the user's goals (with percent, remaining, statusLabel)
//   POST   /api/goals                            create a goal
//   PUT    /api/goals/:id                        change name, targetAmount or deadline
//   DELETE /api/goals/:id?userId=...             delete a goal
//   POST   /api/goals/:id/contributions          add savings to a goal

// Check userId and the goal id from the address. Sends the 400 itself and returns null if wrong.
const apiFilter = (req, res, userId) => {
  if (typeof userId !== 'string' || !userId) {
    res.status(400).json({ error: 'userId is required' });
    return null;
  }
  if (userId.length > 50) {
    res.status(400).json({ error: 'userId must be 50 characters or fewer' });
    return null;
  }
  if (!isId(req.params.id)) {
    res.status(400).json({ error: 'Invalid goal id' });
    return null;
  }
  return { _id: new goal.ObjectId(req.params.id), userId: userId.trim() };
};

// Read: the user's goals. userId must be plain text (blocks tricks like ?userId[$ne]=x).
const sendGoals = async (req, res, userId) => {
  try {
    if (typeof userId !== 'string' || !userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    const docs = await goal.findGoals(req.db, { userId: userId.trim() });
    res.status(200).json({ data: docs.map((d) => goal.withProgress(d)) });
  } catch (err) {
    res.status(500).json({ error: 'Unable to load goals' });
  }
};

// GET /api/goals/user/:userId        (path style, as in Lecture 8)
api.get('/user/:userId', (req, res) => sendGoals(req, res, req.params.userId));

// GET /api/goals?userId=...
api.get('/', (req, res) => sendGoals(req, res, req.query.userId));

// POST /api/goals    body: { "userId": "...", "name": "Japan Trip", "targetAmount": 1000, "deadline": "2027-03-31" }
api.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    if (userId.length > 50) return res.status(400).json({ error: 'userId must be 50 characters or fewer' });

    const values = formValues(body);
    const errors = goal.goalErrors(values);
    if (errors.length > 0) return res.status(400).json({ error: errors });

    const result = await goal.insertGoal(req.db, {
      userId,
      name: values.name,
      targetAmount: goal.parseMoney(values.targetAmount),
      deadline: values.deadline || null
    });
    const created = await goal.findGoal(req.db, { _id: result.insertedId });
    res.status(201).json({ message: 'Goal created', data: goal.withProgress(created) });
  } catch (err) {
    res.status(500).json({ error: 'Unable to create goal' });
  }
});

// PUT /api/goals/:id    body: { "userId": "...", "targetAmount": 2000 }   (send only what changes)
api.put('/:id', async (req, res) => {
  try {
    const body = req.body || {};
    const filter = apiFilter(req, res, body.userId);
    if (!filter) return;
    if ('savedAmount' in body) {
      return res.status(400).json({ error: 'savedAmount cannot be changed here. Use POST /api/goals/:id/contributions' });
    }
    if (!['name', 'targetAmount', 'deadline'].some((k) => k in body)) {
      return res.status(400).json({ error: 'Nothing to update. Send name, targetAmount or deadline' });
    }
    const found = await goal.findGoal(req.db, filter);
    if (!found) return res.status(404).json({ error: 'Goal not found' });

    // anything not sent keeps its current value; "deadline": null clears the deadline
    const values = formValues({
      name: 'name' in body ? body.name : found.name,
      targetAmount: 'targetAmount' in body ? body.targetAmount : found.targetAmount,
      deadline: 'deadline' in body ? body.deadline : found.deadline
    });
    const errors = goal.goalErrors(values);
    if (errors.length > 0) return res.status(400).json({ error: errors });

    await saveEdit(req.db, filter, found, values);
    const updated = await goal.findGoal(req.db, filter);
    res.status(200).json({ message: 'Goal updated', data: goal.withProgress(updated) });
  } catch (err) {
    res.status(500).json({ error: 'Unable to update goal' });
  }
});

// DELETE /api/goals/:id?userId=...
api.delete('/:id', async (req, res) => {
  try {
    const filter = apiFilter(req, res, req.query.userId);
    if (!filter) return;
    const result = await goal.deleteGoal(req.db, filter);
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Goal not found' });
    res.status(200).json({ message: 'Goal deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Unable to delete goal' });
  }
});

// POST /api/goals/:id/contributions    body: { "userId": "...", "amount": 250 }
api.post('/:id/contributions', async (req, res) => {
  try {
    const body = req.body || {};
    const filter = apiFilter(req, res, body.userId);
    if (!filter) return;
    const amount = goal.parseMoney(body.amount);
    if (!validAmount(amount)) {
      return res.status(400).json({ error: 'amount must be a number greater than 0, with at most 2 decimals' });
    }
    const found = await goal.findGoal(req.db, filter);
    if (!found) return res.status(404).json({ error: 'Goal not found' });

    const { reached } = await saveSavings(req.db, filter, found, amount);
    const updated = await goal.findGoal(req.db, filter);
    res.status(201).json({
      message: reached ? 'Savings added. Goal reached!' : 'Savings added',
      reachedTarget: reached,
      data: goal.withProgress(updated)
    });
  } catch (err) {
    res.status(500).json({ error: 'Unable to add savings' });
  }
});

module.exports = { pages, api };
