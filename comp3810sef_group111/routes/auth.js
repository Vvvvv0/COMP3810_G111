// routes/auth.js  [Member 2 replaces]  
const express = require('express');
const pages = express.Router();

pages.get('/', (req, res) => {
  res.status(200).render('home/index', { title: 'Budget App', user: req.session });
});

module.exports = { pages };