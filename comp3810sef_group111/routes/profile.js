// routes/profile.js  [Member 2 replaces]  
const express = require('express');
const pages = express.Router();
const api = express.Router();
const user = require('../models/user');
const {ObjectId} = require('mongodb');



  pages.get('/', async (req, res, next) => {
    try {
      const userId = req.session.userId;
      if (typeof userId !== 'string' || !ObjectId.isValid(userId)) {
        req.session = null;
        return res.redirect('/login');
      }

      
      const id = new ObjectId(userId);
      const found = await user.findUser(req.db,{_id:id});

      if (!found) {
        req.session = null;
        return res.redirect('/login');
      }

      return res.status(200).render('profile/profile', {
        title: 'My Profile',
        user: req.session,
        profile: { username: found.username, email: found.email || '' },
        errors: [],
        success: req.query.success === '1'? 'Profile updated successfully' : null
      });
    }catch (err) {
      next(err);
    }
      });

  pages.post('/', async (req, res, next) => {
    try {
      const userId = req.session.userId;

      if (typeof userId !== 'string' || !ObjectId.isValid(userId)) {
        req.session = null;
        return res.redirect('/login');
      }

      const id = new ObjectId(userId);
      const found = await user.findUser(req.db,{_id:new ObjectId(userId)});
      const session = req.session.userId;
      const body = req.body || {};

      const fields =['email', 'currentPassword','newPassword','confirmNewPassword'];

      if (typeof session !== 'string' || !ObjectId.isValid(session)) {
        req.session = null;
        return res.redirect('/login');
      }
      if (!found) {
        req.session = null;
        return res.redirect('/login');
      }
      if (fields.some(name => body[name] !== undefined && typeof body[name] !== 'string')) {
        return res.status(400).send('Invalid input');
      }

      const email = (body.email || '').trim();
      const currentPassword = body.currentPassword || '';
      const newPassword = body.newPassword || '';
      const confirmNewPassword = body.confirmNewPassword || ''; 
      const errors = [];
      const change = {email};
      const emailMsg = req.app.locals.validateEmail(email);
      if (emailMsg) {
        errors.push(emailMsg);}
      else {
        const existingEmail = await user.findUser(req.db, { email, _id: { $ne: id } });
        if (existingEmail) {
          errors.push('Email is already in use');
        }
      }

      const changedPassword = currentPassword != '' || newPassword != '' || confirmNewPassword != '';
      if (changedPassword) {
        if (currentPassword !== found.password) {
          errors.push('Current password is incorrect');
        }
        const passwordErrors = req.app.locals.passwordErrors(newPassword, confirmNewPassword, found.username);
        errors.push(...passwordErrors);
      }

      if (errors.length > 0) {
        return res.status(400).render('profile/profile', {
          title: 'My Profile',
          user: req.session,
          profile: { username:found.username, email},
          errors,
          success: null
        });}

        if (changedPassword) {
          change.password = newPassword;
        }

        const result = await user.updateUser(req.db, { _id: new ObjectId(userId) }, change);
        if (result.matchedCount === 0) {
          req.session = null;
          return res.redirect('/login');
        }
        return res.redirect('/profile?success=1');
      
    } catch (err) {
      next(err);
    }
  });
// REST API (no login; userId is given with each request, like the other APIs)
// GET /api/profile?userId=...
api.get('/', async (req, res) => {
  try {
    const userId = req.query.userId;

    if (typeof userId !== 'string' || !ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Invalid userId' });
    }

    const id = new ObjectId(userId);
    const found = await user.findUser(req.db, { _id: id });

    if (!found) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    return res.status(200).json({ userId: found._id.toString(), username: found.username, email: found.email || '' });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// PUT /api/profile   body: { "userId": "...", "email": "..." }
api.put('/', async (req, res) => {
  try {
    const body = req.body || {};
    const userId = body.userId;

    if (typeof userId !== 'string' || !ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Invalid userId' });
    }

    const id = new ObjectId(userId);

    const found = await user.findUser(req.db, { _id: id });

    if (!found) {
      return res.status(404).json({ error: 'User not found' });
    }

    const fields = ['email', 'currentPassword', 'newPassword', 'confirmNewPassword'];

    if (fields.some(name => body[name] !== undefined && typeof body[name] !== 'string')) {
      return res.status(400).json({ error: 'Invalid input' });
    }
    const email = (body.email || '').trim();
    const currentPassword = body.currentPassword || '';
    const newPassword = body.newPassword || '';
    const confirmNewPassword = body.confirmNewPassword || '';
    const errors = [];
    const change = { email };  
    const passwordErrors = req.app.locals.passwordErrors(newPassword, confirmNewPassword, found.username);
    const emailMsg = req.app.locals.validateEmail(email);
    if (emailMsg) {
      errors.push(emailMsg);
    } else {
      const existingEmail = await user.findUser(req.db, { email, _id: { $ne: id } });
      if (existingEmail) {
        errors.push('Email is already in use');
      }
    }

    const changedPassword = currentPassword !== '' || newPassword !== '' || confirmNewPassword !== '';

    if (changedPassword) {
      if (currentPassword !== found.password) {
        errors.push('Current password is incorrect');
      }
      errors.push(...passwordErrors);
    }
    
    if (errors.length > 0) {
      return res.status(400).json({ error: errors });
    }

    if (changedPassword) {
      change.password = newPassword;
    }

    const result = await user.updateUser(req.db, { _id: id }, change);
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json({ message: 'Profile updated successfully', userId: id.toHexString() });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Unable to update profile' });
  }
});

module.exports = { pages,api };
