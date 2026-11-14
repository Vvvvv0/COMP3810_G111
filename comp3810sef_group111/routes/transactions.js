// routes/transactions.js  [Member 3 replaces]  
const express = require('express');
const tx = require('../models/transaction');

const pages = express.Router();
const api = express.Router();

const uid = (req) => String(req.session.userId || '');

pages.get('/', async (req, res) => {
  const userId = uid(req);
  const filter = tx.buildFilter({ ...req.query, userId });
  const transactions = await tx.findTransactions(req.db, filter);
  const { income, expense } = await tx.sumByType(req.db, userId, req.query);
  res.render('transactions/list', {
    title: 'My Transactions',
    user: req.session,
    transactions,
    filter: req.query,
    categories: tx.CATEGORIES,
    summary: { income, expense, net: income - expense },
    success: req.query.success || null,
    errors: null
  });
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

pages.post('/', async (req, res) => {
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
});

pages.get('/:id/edit', async (req, res) => {
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
});

pages.post('/:id', async (req, res) => {
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
});

pages.post('/:id/delete', async (req, res) => {
  const t = await tx.findTransactionById(req.db, req.params.id);
  if (!t || String(t.userId) !== uid(req)) {
    return res.status(404).send('Transaction not found');
  }
  await tx.deleteTransaction(req.db, { _id: new tx.ObjectId(req.params.id), userId: uid(req) });
  res.redirect('/transactions?success=deleted');
});

api.get('/', async (req, res) => {
  if (!req.query.userId) return res.status(400).json({ error: 'userId is required' });
  const data = await tx.findTransactions(req.db, tx.buildFilter(req.query));
  res.status(200).json({ data });
});

api.get('/:id', async (req, res) => {
  const t = await tx.findTransactionById(req.db, req.params.id);
  if (!t) return res.status(404).json({ error: 'not found' });
  res.status(200).json({ data: t });
});

api.post('/', async (req, res) => {
  if (!req.body.userId) return res.status(400).json({ error: 'userId is required' });
  const err = tx.validateTransaction(req.body);
  if (err) return res.status(400).json({ error: err });
  const result = await tx.insertTransaction(req.db, {
    userId: String(req.body.userId),
    type: req.body.type,
    amount: Number(req.body.amount),
    category: req.body.category,
    date: new Date(req.body.date),
    note: req.body.note || ''
  });
  res.status(201).json({ data: { _id: result.insertedId, ...req.body } });
});

api.put('/:id', async (req, res) => {
  if (!tx.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'invalid id' });
  const err = tx.validateTransaction(req.body);
  if (err) return res.status(400).json({ error: err });
  const result = await tx.updateTransaction(
    req.db,
    { _id: new tx.ObjectId(req.params.id) },
    {
      userId: req.body.userId ? String(req.body.userId) : undefined,
      type: req.body.type,
      amount: Number(req.body.amount),
      category: req.body.category,
      date: new Date(req.body.date),
      note: req.body.note || ''
    }
  );
  if (result.matchedCount === 0) return res.status(404).json({ error: 'not found' });
  res.status(200).json({ data: { _id: req.params.id, ...req.body } });
});

api.delete('/:id', async (req, res) => {
  if (!tx.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'invalid id' });
  const result = await tx.deleteTransaction(req.db, { _id: new tx.ObjectId(req.params.id) });
  if (result.deletedCount === 0) return res.status(404).json({ error: 'not found' });
  res.status(200).json({ data: { _id: req.params.id } });
});

module.exports = { pages, api };
