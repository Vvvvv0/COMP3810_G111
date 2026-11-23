// routes/goals.js  [Member 1]
// Saving goals: web pages (list, add, edit, delete, add savings) + REST API.
const express = require('express');
const goal = require('../models/goal');
const user = require('../models/user');
const pages = express.Router();
const api = express.Router();

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
// Search options on the list page: a name keyword and a status (In progress, Completed, Overdue)
const STATUS_FILTERS = ['In progress', 'Completed', 'Overdue'];

const renderList = async (req, res, status, errors, message) => {
  const filters = {
    keyword: typeof req.query.keyword === 'string' ? req.query.keyword.trim() : '',
    status: typeof req.query.status === 'string' && STATUS_FILTERS.includes(req.query.status) ? req.query.status : ''
  };
  const all = await goal.findGoals(req.db, { userId: req.session.userId });
  all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));   // newest first

  let goals = all.map((g) => goal.withProgress(g));
  if (filters.keyword) {
    const word = filters.keyword.toLowerCase();
    goals = goals.filter((g) => String(g.name).toLowerCase().includes(word));   // plain text match, no regex
  }
  if (filters.status) goals = goals.filter((g) => g.statusLabel === filters.status);

  res.status(status).render('goals/list', {
    title: 'My Goals', user: req.session, goals, errors, message,
    filters, totalCount: all.length
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
//   GET    /api/goals/:id?userId=...             one goal
//   search: /api/goals/user/:userId/keyword/:keyword/status/:status   (or ?keyword=...&status=... with quotes)
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
  if (!isId(userId)) {
    res.status(400).json({ error: 'userId must be a 24-character id' });
    return null;
  }
  if (!isId(req.params.id)) {
    res.status(400).json({ error: 'Invalid goal id' });
    return null;
  }
  return { _id: new goal.ObjectId(req.params.id), userId: userId.toLowerCase() };
};

// ---- Search options for the list API ----
// keyword = part of the goal name (not case-sensitive)
// status  = in-progress, completed or overdue (upper or lower case; "In progress" also works)
const STATUS_NAMES = { 'in-progress': 'In progress', 'in progress': 'In progress', completed: 'Completed', overdue: 'Overdue' };
const toStatusName = (v) => STATUS_NAMES[String(v).trim().toLowerCase()] || null;

// Read: the user's goals, optionally searched.
// userId, keyword and status must be plain text (blocks tricks like ?userId[$ne]=x).
const sendGoals = async (req, res, userId, keywordInput, statusInput) => {
  try {
    if (typeof userId !== 'string' || !userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    if (keywordInput !== undefined && typeof keywordInput !== 'string') {
      return res.status(400).json({ error: 'keyword must be text' });
    }
    const keyword = (keywordInput || '').trim();

    let status = '';
    if (statusInput !== undefined && statusInput !== '') {
      status = typeof statusInput === 'string' ? toStatusName(statusInput) : null;
      if (!status) {
        return res.status(400).json({ error: 'status must be in-progress, completed or overdue' });
      }
    }

    const docs = await goal.findGoals(req.db, { userId: isId(userId) ? userId.toLowerCase() : userId });
    let list = docs.map((d) => goal.withProgress(d));
    if (keyword) list = list.filter((g) => String(g.name).toLowerCase().includes(keyword.toLowerCase()));
    if (status) list = list.filter((g) => g.statusLabel === status);

    // "filters" and "count" show what the server really applied
    res.status(200).json({ count: list.length, filters: { keyword, status }, data: list });
  } catch (err) {
    res.status(500).json({ error: 'Unable to load goals' });
  }
};

// Path style (Lecture 8): no "?" or "&" is needed, so nothing can be cut off by the shell.
//   GET /api/goals/user/:userId
//   GET /api/goals/user/:userId/keyword/:keyword
//   GET /api/goals/user/:userId/status/:status
//   GET /api/goals/user/:userId/keyword/:keyword/status/:status
api.get('/user/:userId', (req, res) =>
  sendGoals(req, res, req.params.userId, req.query.keyword, req.query.status));
api.get('/user/:userId/keyword/:keyword', (req, res) =>
  sendGoals(req, res, req.params.userId, req.params.keyword, undefined));
api.get('/user/:userId/status/:status', (req, res) =>
  sendGoals(req, res, req.params.userId, undefined, req.params.status));
api.get('/user/:userId/keyword/:keyword/status/:status', (req, res) =>
  sendGoals(req, res, req.params.userId, req.params.keyword, req.params.status));

// Query style: GET /api/goals?userId=...&keyword=...&status=...   (put the address in quotes)
api.get('/', (req, res) => sendGoals(req, res, req.query.userId, req.query.keyword, req.query.status));

// GET /api/goals/:id?userId=...   one goal of this user (404 if it is not found or belongs to someone else)
api.get('/:id', async (req, res) => {
  try {
    const filter = apiFilter(req, res, req.query.userId);
    if (!filter) return;
    const found = await goal.findGoal(req.db, filter);
    if (!found) return res.status(404).json({ error: 'Goal not found' });
    res.status(200).json({ data: goal.withProgress(found) });
  } catch (err) {
    res.status(500).json({ error: 'Unable to load goal' });
  }
});

// POST /api/goals    body: { "userId": "...", "name": "Japan Trip", "targetAmount": 1000, "deadline": "2027-03-31" }
api.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    if (!isId(body.userId)) {
      return res.status(400).json({ error: 'userId is required (24-character user id)' });
    }
    const userId = body.userId.toLowerCase();
    const owner = await user.findUser(req.db, { _id: new goal.ObjectId(userId) });
    if (!owner) return res.status(404).json({ error: 'User not found' });

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
