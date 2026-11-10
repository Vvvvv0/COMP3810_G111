// routes/auth.js  [Member 2 replaces]  
const express = require('express');
const pages = express.Router();
const user = require('../models/user');
const api = express.Router();
const bodyForm = (body = {}) => ({
  username: (body.username || '').trim(),
  email: (body.email || '').trim(),
  password: body.password || '',
  confirmPassword: body.confirmPassword || ''
});

pages.get('/', (req, res) => {
  res.status(200).render('home/index', { title: 'Budget App', user: req.session });
});


// register page
pages.get('/register', (req, res) => {
 res.render('auth/register',{
  title: 'Register',
  user: req.session,
  values: { username: '', email: '' },
  errors: null,
  registered: false
 })
});

pages.post('/register', async (req, res, next) => {
  try{
    const data = bodyForm(req.body);
    const errors = req.app.locals.passwordErrors( data.password, data.confirmPassword, data.username);
    if (!data.username || !data.email || !data.password || !data.confirmPassword) {
      errors.push('All fields are required');
    }
    const emailMsg = req.app.locals.validateEmail(data.email);
    if (emailMsg) errors.push(emailMsg);
    
     if (await user.findUser(req.db, { username: data.username })) {
        errors.push('Username already exists');
      } 
     if (await user.findUser(req.db, { email: data.email })) {
        errors.push('Email already registered');
      }
      if (errors.length > 0) {
      return res.status(400).render('auth/register', {
        title: 'Register',
        user: req.session,
        values: { username: data.username, email: data.email },
        errors,
        error: null,              
        registered: false
      },
      );
    }
    await user.insertUser(req.db, 
      { username: data.username,
         email: data.email,
        password: data.password });

        res.redirect('/login?registered=1');
  }catch (err) {
    next(err);
  }
});
// login page
pages.get('/login', (req, res) => {
  res.render('auth/login', {
    title: 'Login',
    user: req.session,
    values: { username: '' },
    errors: null,
    error: null,
    registered: req.session.registered === "1"
  });
});

pages.post('/login', async (req, res, next) => {
  try {
    const username = (req.body.username || '').trim();
    const password = req.body.password || '';
    let found = null;

    if (username && password) {
      found = await user.findUser(req.db, { username, password });
    }

    if (!found) {
      return res.status(401).render('auth/login', {
        title: 'Login',
        user: req.session,
        values: { username },
        errors: [],
        error: 'Invalid username or password',
        registered:false
      });
    }

    req.session.userId = found._id.toString();
    return res.redirect('/profile');
   
  } catch (err) {
    next(err);
  }});
 

    // logout 
pages.get('/logout', (req, res) => {
  req.session = null
  res.redirect('/');
});


api.post('/login', async (req, res) => {
  try{
    const body = req.body || {};

    if (typeof body.username !== 'string' || typeof body.password !== 'string') {
      return res.status(400).json({ error: 'username and passwords must be strings' });
    }
    const username = body.username.trim();
    const password = body.password
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const found = await user.findUser(req.db, { username, password });
    

    if (!found) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    const userId = found._id.toString();
    req.session.userId = userId;
    return res.status(200).json({ message: 'Login successful', userId });
  }catch (err) {
    return res.status(500).json({ error: 'Unable to login' });
  }
});

api.post('/register', async (req, res) => {
  try{
    const body = req.body || {};
    const fields = ['username', 'email', 'password', 'confirmPassword'];
    if (fields.some(name => body[name] !== undefined && typeof body[name] !== 'string')) {
      return res.status(400).json({ error: 'Invalid input' });
    }

    const data = bodyForm(req.body);
    const errors = [];
    const emailMsg = req.app.locals.validateEmail(data.email);
    const passwordErrors = req.app.locals.passwordErrors(data.password, data.confirmPassword, data.username);
    
    if (emailMsg) errors.push(emailMsg);
    errors.push(...passwordErrors);
    if (!data.username || !data.email || !data.password || !data.confirmPassword) {
      errors.push('All fields are required');
    }
    if (errors.length > 0) {
      return res.status(400).json({ error: errors });
    }
    if (await user.findUser(req.db, { username: data.username })) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    if (await user.findUser(req.db, { email: data.email })) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const result = await user.insertUser(req.db, {
      username: data.username,
      email: data.email,
      password: data.password,
      displayName: ''
    });
    return res.status(201).json({ message: 'User registered successfully', userId: result.insertedId.toString() });
  }catch(err){
    console.error(err);
    return res.status(500).json({ error: 'Unable to register user' });
  }})
module.exports = { pages, api };
