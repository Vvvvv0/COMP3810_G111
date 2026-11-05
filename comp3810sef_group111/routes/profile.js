// routes/profile.js  [Member 2 replaces]  
const express = require('express');
module.exports = { pages: express.Router() };

pages.get('/', async (req, res) => {
  const found = await user.findUser(req.db, { _id: new ObjectId(req.session.userId) });
  res.render('profile/profile', {
    title: 'My Profile',
    user: req.session,
    profile: { username: found.username, displayName: found.displayName, email: found.email },
    errors: [],
    success: null
  });
});