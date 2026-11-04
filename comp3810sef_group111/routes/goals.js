// routes/goals.js  [Member 1]  
const express = require('express');
const goal = require('../models/goal');
const pages = express.Router();
const api = express.Router();

pages.get('/', async (req, res) => {
  const goals = await goal.findGoals(req.db, { userId: req.session.userId });
  res.status(200).render('goals/list', { title: 'My Goals', user: req.session, goals });
});

// GET /api/goals?userId=...
api.get('/', async (req, res) => {
  if (!req.query.userId) return res.status(400).json({ error: 'userId is required' });
  const goals = await goal.findGoals(req.db, { userId: req.query.userId });
  res.status(200).json({ data: goals });
});

module.exports = { pages, api };