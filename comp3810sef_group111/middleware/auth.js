// middleware/auth.js  [Member 2]
// Blocks CRUD pages for users who are not logged in.
// The API routes are not protected, as the spec allows.
module.exports = function (req, res, next) {
  if (!req.session.authenticated) return res.redirect('/login');
  next();
};