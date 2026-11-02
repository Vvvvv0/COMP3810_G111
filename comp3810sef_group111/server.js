const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI ||
  'mongodb+srv://v7471750_db_user:demo_user123@cluster0.m7gufge.mongodb.net/';

// ===== SHARED SETUP (Member 1) =====
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');
app.use(express.static(__dirname + '/public'));
app.use(session({
  secret: process.env.SESSION_SECRET || 'change-this-secret',
  resave: false,
  saveUninitialized: false
}));

// ===== MEMBER 2: AUTH AND PROFILE =====
// (routes added in Stage 2)

// ===== MEMBER 3: TRANSACTIONS =====
// (routes added in Stage 2)

// ===== MEMBER 4: BUDGETS AND DASHBOARD =====
// (routes added in Stage 2)

// ===== HOMEPAGE =====
app.get('/', (req, res) => {
  res.send('<h1>Personal Expense and Budget Tracker</h1>');
});

// ===== START =====
mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(PORT, () => console.log(`Server on http://localhost:${PORT}`));
  })
  .catch(err => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  });
