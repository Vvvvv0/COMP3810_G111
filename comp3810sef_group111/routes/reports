// routes/reports.js [Member 4] monthly summary API
const express = require('express');
const api = express.Router();

const budget = require('../models/budget');

// GET /api/reports/summary?userId=...&month=YYYY-MM
api.get('/summary', async (req, res) => {
  const { userId, month } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId is required' });
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: 'month must be YYYY-MM' });
  }

  const spent = await budget.getSpent(req.db, userId, month);
  const rows = await budget.getBudgetUsage(req.db, userId, month);

  const totalBudget = rows.reduce((s, b) => s + (Number(b.amount) || 0), 0);
  const totalSpent = spent.overall || 0;
  const remaining = totalBudget - totalSpent;
  const usagePct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

  res.json({
    userId,
    month,
    totalBudget,
    totalSpent,
    remaining,
    usagePct,
    byCategory: spent.byCategory,
    budgets: rows,
  });
});

module.exports = { api };
