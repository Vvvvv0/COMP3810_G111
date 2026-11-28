// routes/transactions.js
const express = require('express');
const tx = require('../models/transaction');

const pages = express.Router();
const api = express.Router();

const uid = (req) => String(req.session.userId || '');

pages.get('/', async (req, res, next) => {
  try {
    const userId = uid(req);
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_LIMIT));
    const filter = tx.buildFilter({ ...req.query, userId });
    const count = await tx.countTransactions(req.db, filter);
    const totalPages = Math.max(1, Math.ceil(count / limit));
    const page = Math.min(totalPages, Math.max(1, parseInt(req.query.page, 10) || 1));
    const transactions = await tx.findTransactionPage(req.db, filter, (page - 1) * limit, limit);
    const { income, expense } = await tx.sumByType(req.db, userId, req.query);
    res.render('transactions/list', {
      title: 'My Transactions',
      user: req.session,
      transactions,
      filter: req.query,
      categories: tx.CATEGORIES,
      summary: { income, expense, net: income - expense },
      paging: { count, page, limit, totalPages },
      success: req.query.success || null,
      errors: null
    });
  } catch (err) { next(err); }
});

pages.get('/new', (req, res) => {
  res.render('transactions/new', {
    title: 'New Transaction',
    user: req.session,
    categories: tx.CATEGORIES,
    values: {
      type: 'expense',
      category: 'food',
      amount: '',
      date: new Date().toISOString().slice(0, 10),
      note: ''
    },
    errors: null
  });
});

pages.post('/', async (req, res, next) => {
  try {
    const values = req.body;
    const err = tx.validateTransaction(values);
    if (err) {
      return res.status(400).render('transactions/new', {
        title: 'New Transaction',
        user: req.session,
        categories: tx.CATEGORIES,
        values,
        errors: [err]
      });
    }
    await tx.insertTransaction(req.db, {
      userId: uid(req),
      type: values.type,
      amount: Number(values.amount),
      category: values.category,
      date: new Date(values.date),
      note: values.note || ''
    });
    res.redirect('/transactions?success=created');
  } catch (err) { next(err); }
});

pages.get('/:id/edit', async (req, res, next) => {
  try {
    const t = await tx.findTransactionById(req.db, req.params.id);
    if (!t || String(t.userId) !== uid(req)) {
      return res.status(404).send('Transaction not found');
    }
    res.render('transactions/edit', {
      title: 'Edit Transaction',
      user: req.session,
      categories: tx.CATEGORIES,
      values: { ...t, date: t.date ? new Date(t.date).toISOString().slice(0, 10) : '' },
      errors: null
    });
  } catch (err) { next(err); }
});

pages.post('/:id', async (req, res, next) => {
  try {
    const t = await tx.findTransactionById(req.db, req.params.id);
    if (!t || String(t.userId) !== uid(req)) {
      return res.status(404).send('Transaction not found');
    }
    const values = req.body;
    const err = tx.validateTransaction(values);
    if (err) {
      return res.status(400).render('transactions/edit', {
        title: 'Edit Transaction',
        user: req.session,
        categories: tx.CATEGORIES,
        values: { ...values, _id: req.params.id },
        errors: [err]
      });
    }
    await tx.updateTransaction(
      req.db,
      { _id: new tx.ObjectId(req.params.id), userId: uid(req) },
      {
        type: values.type,
        amount: Number(values.amount),
        category: values.category,
        date: new Date(values.date),
        note: values.note || ''
      }
    );
    res.redirect('/transactions?success=updated');
  } catch (err) { next(err); }
});

pages.post('/:id/delete', async (req, res, next) => {
  try {
    const t = await tx.findTransactionById(req.db, req.params.id);
    if (!t || String(t.userId) !== uid(req)) {
      return res.status(404).send('Transaction not found');
    }
    await tx.deleteTransaction(req.db, { _id: new tx.ObjectId(req.params.id), userId: uid(req) });
    res.redirect('/transactions?success=deleted');
  } catch (err) { next(err); }
});

// [Member 4] Transaction details page  GET /transactions/:id
pages.get('/:id', async (req, res, next) => {
  try {
    const t = await tx.findTransactionById(req.db, req.params.id);

    if (!t || String(t.userId) !== uid(req)) {
      return res.status(404).send('404 Not Found');
    }

    const amt = Number(t.amount) || 0;

    res.render('transactions/list', {
      title: 'Transaction Details',
      user: req.session,
      transactions: [t],
      paging: { count: 1, page: 1, limit: 1, totalPages: 1 },
      filter: {},
      categories: tx.CATEGORIES,
      summary: {
        income: t.type === 'income' ? amt : 0,
        expense: t.type === 'expense' ? amt : 0,
        net: t.type === 'income' ? amt : -amt,
      },
      success: null,
      errors: null,
    });
  } catch (err) { next(err); }
});

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// Keyword text is matched literally, so characters such as ( or * cannot break the search.
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// A real calendar day in YYYY-MM-DD form (rejects 2026-02-30)
const isDay = (t) => typeof t === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t) &&
  !Number.isNaN(Date.parse(t)) && new Date(t).toISOString().slice(0, 10) === t;

const isId = (v) => typeof v === 'string' && /^[a-f\d]{24}$/i.test(v);

// Checks a transaction body and returns the first problem found, or null
const bodyError = (b) => {
  const err = tx.validateTransaction(b);
  if (err) return err;
  if (!tx.CATEGORIES.includes(b.category)) return 'category must be one of: ' + tx.CATEGORIES.join(', ');
  if (!isDay(b.date)) return 'date must be a date as YYYY-MM-DD';
  return null;
};

// GET /api/transactions?userId=...
// Returns all transactions by default. Optional: type, category, from, to, keyword, limit.
api.get('/', async (req, res) => {
  try {
    const q = req.query;
    if (!q.userId) return res.status(400).json({ error: 'userId is required' });
    if (q.page !== undefined) return res.status(400).json({ error: 'page is not supported; use limit only' });
    if (q.type !== undefined && !['income', 'expense'].includes(q.type)) {
      return res.status(400).json({ error: 'type must be income or expense' });
    }
    if (q.category !== undefined && !tx.CATEGORIES.includes(q.category)) {
      return res.status(400).json({ error: 'category must be one of: ' + tx.CATEGORIES.join(', ') });
    }
    if (q.from !== undefined && !isDay(q.from)) return res.status(400).json({ error: 'from must be a date as YYYY-MM-DD' });
    if (q.to !== undefined && !isDay(q.to)) return res.status(400).json({ error: 'to must be a date as YYYY-MM-DD' });
    if (q.from && q.to && q.from > q.to) return res.status(400).json({ error: 'from must be on or before to' });
    if (q.keyword !== undefined && typeof q.keyword !== 'string') return res.status(400).json({ error: 'keyword must be text' });

    let limit = null;
    if (q.limit !== undefined) {
      limit = Number(q.limit);
      if (!Number.isInteger(limit) || limit < 1) return res.status(400).json({ error: 'limit must be a whole number, 1 or more' });
    }

    const filter = tx.buildFilter({ ...q, keyword: q.keyword ? escapeRegex(q.keyword) : undefined });
    const total = await tx.countTransactions(req.db, filter);
    const data = await tx.findTransactionPage(req.db, filter, 0, limit || total);
    res.status(200).json({ count: data.length, total, limit, data });
  } catch (err) {
    res.status(500).json({ error: 'Unable to load transactions' });
  }
});

// GET /api/transactions/:id?userId=...
api.get('/:id', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    if (!isId(req.params.id)) return res.status(400).json({ error: 'Invalid transaction id' });

    const t = await tx.findTransactionById(req.db, req.params.id);
    if (!t || String(t.userId) !== String(userId)) return res.status(404).json({ error: 'Transaction not found' });
    res.status(200).json({ data: t });
  } catch (err) {
    res.status(500).json({ error: 'Unable to load transaction' });
  }
});

// POST /api/transactions   body: { userId, type, amount, category, date, note }
api.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.userId) return res.status(400).json({ error: 'userId is required' });
    const err = bodyError(body);
    if (err) return res.status(400).json({ error: err });

    const doc = {
      userId: String(body.userId),
      type: body.type,
      amount: Number(body.amount),
      category: body.category,
      date: new Date(body.date),
      note: body.note || ''
    };
    const result = await tx.insertTransaction(req.db, doc);
    res.status(201).json({ message: 'Transaction created', data: { _id: result.insertedId, ...doc } });
  } catch (err) {
    res.status(500).json({ error: 'Unable to create transaction' });
  }
});

// PUT /api/transactions/:id   body: { userId, type, amount, category, date, note }
api.put('/:id', async (req, res) => {
  try {
    const body = req.body || {};
    if (!isId(req.params.id)) return res.status(400).json({ error: 'Invalid transaction id' });
    if (!body.userId) return res.status(400).json({ error: 'userId is required' });
    const err = bodyError(body);
    if (err) return res.status(400).json({ error: err });

    const result = await tx.updateTransaction(
      req.db,
      { _id: new tx.ObjectId(req.params.id), userId: String(body.userId) },   // owner only
      {
        type: body.type,
        amount: Number(body.amount),
        category: body.category,
        date: new Date(body.date),
        note: body.note || ''
      }
    );
    if (result.matchedCount === 0) return res.status(404).json({ error: 'Transaction not found' });

    const updated = await tx.findTransactionById(req.db, req.params.id);
    res.status(200).json({ message: 'Transaction updated', data: updated });
  } catch (err) {
    res.status(500).json({ error: 'Unable to update transaction' });
  }
});

// DELETE /api/transactions/:id?userId=...
api.delete('/:id', async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ error: 'Invalid transaction id' });
    const userId = req.query.userId || (req.body && req.body.userId);
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const result = await tx.deleteTransaction(req.db, { _id: new tx.ObjectId(req.params.id), userId: String(userId) });   // owner only
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Transaction not found' });
    res.status(200).json({ message: 'Transaction deleted', data: { _id: req.params.id } });
  } catch (err) {
    res.status(500).json({ error: 'Unable to delete transaction' });
  }
});

module.exports = { pages, api };

