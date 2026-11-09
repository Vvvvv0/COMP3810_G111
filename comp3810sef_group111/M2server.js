const express = require('express');
const session = require('cookie-session');
const { MongoClient } = require('mongodb');
const requireLogin = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 8099;
const uri = 'mongodb+srv://Venus:Fung2006@cluster0.p7mch1n.mongodb.net/';  
const dbName = 'COMP3810sef';
const SECRETKEY = 'comp3810-group111-secret';
const client = new MongoClient(uri);

// Set password errors for such rules:
// 1. >= 8 characters
// 2. At least one uppercase letter
// 3. At least one lowercase letter
// 4. Password must contain at least one number
// 5. Password must contain only letters and numbers
// 6. Password must not contain the username
// 7. Passwords must match


function passwordError(password,confirmPassword,username) {
  const errors = [];
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  if (!/[^A-Za-z0-9\s]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  if (password.toLowerCase().includes(username.toLowerCase())) {
    errors.push('Password must not contain the username');
  }
  if (password !== confirmPassword) {
    errors.push('Passwords do not match');
  }
  
  return errors;
}

function validateEmail(email) {
  if (!email) return 'Email is required';
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return 'Invalid email format.Vaild email format: user@example.com';
  }
  return null;
}

app.locals.passwordError = passwordError;
app.locals.validateEmail = validateEmail;

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logger: prints date, method, path and status once each response is sent
app.use((req, res, next) => {
  res.on('finish', () => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path} ${res.statusCode}`);
  });
  next();
});

app.use(session({
  name: 'loginSession',
  keys: [SECRETKEY],
  maxAge: 24 * 60 * 60 * 1000
}));

// Give every route access to the database
app.use((req, res, next) => {
  req.db = client.db(dbName);
  next();
});

// Public pages
app.use('/', require('./routes/auth').pages);

// RESTful APIs (no login, per spec)
app.use('/api/transactions', require('./routes/transactions').api);
app.use('/api/budgets', require('./routes/budgets').api);
app.use('/api/goals', require('./routes/goals').api);

// CRUD pages (login required)
app.use('/profile', requireLogin, require('./routes/profile').pages);
app.use('/transactions', requireLogin, require('./routes/transactions').pages);
app.use('/budgets', requireLogin, require('./routes/budgets').pages);
app.use('/goals', requireLogin, require('./routes/goals').pages);

// 404 and errors, last
app.use((req, res) => {
  res.status(404).send('404 Not Found');
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('Something went wrong');
});

async function main() {
  await client.connect();
  console.log('MongoDB connected');

  app.listen(PORT, function (err) {
    if (err) console.log(err);
    console.log('Server listening on PORT', PORT);
  });
}

main().catch(console.error);
