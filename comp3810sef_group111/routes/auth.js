// routes/auth.js  [Member 2 replaces]  
const express = require('express');
const pages = express.Router();

pages.get('/', (req, res) => {
  res.status(200).render('home/index', { title: 'Budget App', user: req.session });
});

// register page
pages.get('/register', (req, res) => {
 res.render('auth/register',{
  title: 'Login',
  user: req.session,
  values: { username: '' },
  errors: null,
  registered: req.session.registered === "1"
 })
});

pages.get('/login', (req, res) => {
  res.render('auth/login', {
    title: 'Login',
    user: req.session,
    values: { username: '' },
    errors: null,
    registered: req.session.registered === "1"
  });
});

pages.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

module.exports = { pages };
