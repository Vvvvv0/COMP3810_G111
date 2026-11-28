# Personal Expense and Budget Tracker App

COMP3810SEF Autumn 2026 Group Project, Group 111

## 1. Project Info

**Project name:** Personal Expense and Budget Tracker App

**What the server-side app does:**
The server is a Node.js and Express web application backed by MongoDB. It lets a registered user:

- record income and expense transactions, with categories, dates and notes, and search or filter them;
- set monthly budgets (an overall budget plus optional category budgets) and see how much of each budget has been used;
- view a budget dashboard and a monthly summary, including income, expenses and planned spending;
- create saving goals, add savings to them, and track progress and deadlines;
- manage their profile (email and password).

---

## 2. Group Info

**Group number:** 111

**Group members:**

| No. | Name | SID |
|---|---|---|
| 1 | Fung Wing Kei | 13874134 |
| 2 | Chung Ka Ki | 13875708 |
| 3 | Chau Wai Ming | 13874632 |
| 4 | Chen Si Wei | 13772098 |

**Workload division:**

| Member | Role and responsibilities |
|--------|---------------------------|
| Member 1 | Project foundation (`server.js`, `package.json`, models), home page, Saving goals: `routes/goals.js`, `models/goal.js`, goal pages (`views/goals/`), goal REST API |
| Member 2 | User accounts and profile: register, login, logout, profile page, `server.js`, `routes/auth.js`, `routes/profile.js`, `models/user.js`, `middleware/auth.js`, `views/auth/`, `views/profile/` |
| Member 3 | Transactions: `routes/transactions.js`, `models/transaction.js`, transaction pages (`views/transactions/`), transaction REST API |
| Member 4 | Budgets and reports: `routes/budgets.js`, `models/budget.js`, `models/plan.js`, budget pages (`views/budgets/`), budget dashboard, summary API |

Shared work: `server.js`, the home page (`views/home/`), `public/style.css`, and this README.

---

## 3. Project File Introduction

```
comp3810sef_group111/
├── server.js
├── package.json
├── README.md
├── cookies.txt (For RESTful login service)
├── middleware/
│   └── auth.js
├── models/
│   ├── user.js
│   ├── transaction.js
│   ├── budget.js
│   ├── plan.js
│   └── goal.js
├── routes/
│   ├── auth.js
│   ├── profile.js
│   ├── transactions.js
│   ├── budgets.js
│   └── goals.js
├── views/
│   ├── home/        (index.ejs = shared header and layout, home.ejs = landing page)
│   ├── auth/        (login.ejs, register.ejs)
│   ├── profile/     (profile.ejs)
│   ├── transactions/ (list.ejs, new.ejs, edit.ejs)
│   ├── budgets/     (list.ejs, form.ejs, dashboard.ejs)
│   └── goals/       (list.ejs, form.ejs)
├── public/
│   └── style.css
```

### `server.js`
The entry point. It:

- connects to MongoDB and starts the Express server on port 8099;
- sets EJS as the view engine and serves the `public/` folder as static files;
- parses JSON and form data, logs each request (date, method, path, status);
- sets up cookie-based sessions (cookie name `loginSession`, valid for 24 hours);
- adds `req.db` so every route can reach the database;
- mounts the public pages, the REST APIs under `/api`, and the CRUD pages under `/profile`, `/transactions`, `/budgets` and `/goals` (these require login);
- provides a 404 page and a general error handler.
- defines the shared password rules and email check, which are used by the register and profile routes.

### `package.json`
Lists the project name, the Node.js version requirement (`>= 18.0.0`), and the dependencies:

- `express` (*): web server and routing
- `ejs` (*): HTML templates
- `cookie-session` (^2.1.0): login sessions
- `mongodb` (6.9.0): MongoDB driver

The start script is `npm start`, which runs `node server.js`.

### `public/`
Static files served at `/` and `/public`:

- `style.css`: the single stylesheet used by all pages (layout, forms, tables, buttons, messages).

### `views/`
EJS templates for the web pages:

- `home/index.ejs`: shared page header with navigation. It shows Transactions, Budgets, Goals, Profile and Logout when logged in, and Login and Register when not. Other pages include it.
- `home/home.ejs`: landing page.
- `auth/login.ejs`, `auth/register.ejs`: login and register forms.
- `profile/profile.ejs`: view and update email or password.
- `transactions/list.ejs`: transaction list with filters, totals, paging, edit and delete. `new.ejs` is the add form, `edit.ejs` the edit form.
- `budgets/list.ejs`: budgets for a chosen month with usage and warnings. `form.ejs` is the add and edit form. `dashboard.ejs` shows the monthly plan and budget usage.
- `goals/list.ejs`: goals with progress, search and status filter, add savings, edit and delete. `form.ejs` is the add and edit form.

### `models/`
Database access and business rules. Routes call these functions, and the models do not touch `req` or `res`.

- `user.js`: find, insert and update users (collection `users`).
- `transaction.js`: validation, categories (food, transportation, shopping, entertainment, housing, health, education, salary, other), search filters, paging, and income and expense totals (collection `transactions`).
- `budget.js`: budget validation, duplicate check, the overall-budget rule (category budgets cannot exceed the overall budget for that month), budget usage (spent, remaining, percent used, warning at 80% or more) (collection `budgets`).
- `plan.js`: money planning. Net balance = total income - total expenses - total saved in goals. Blocks savings when the balance is negative or too small, and builds the monthly plan (collection `goals` is read here).
- `goal.js`: goal validation, progress, status (In progress, Completed, Overdue), and database access (collection `goals`).

### `routes/`
- `auth.js`: register, login and logout pages; login and register APIs.
- `profile.js`: profile page and profile API.
- `transactions.js`: transaction pages and REST API.
- `budgets.js`: budget pages, budget REST API and the monthly summary API.
- `goals.js`: goal pages and goal REST API.

### `middleware/auth.js`
A login check. Sends users who are not logged in to `/login`. In this project the check is applied in `server.js` to the CRUD pages, and the APIs are left open as the spec allows.

---

## 4. Operation Guide

### 4.1 Setup and start

```bash
npm install
npm start
```

Then open `http://localhost:8099` in a browser.

### 4.2 Login and logout pages

**Demo account (valid login information):**

| Username | Password |
|----------|----------|
| `demo_user` | `Demo_123` |

You can also register a new account (see the steps below).

**Password rules for registration and for changing the password:**

- at least 8 characters, with no spaces;
- at least one uppercase letter, one lowercase letter, one number and one special character;
- must not contain the username;
- the confirmation must match.

**Email:** must be in the form `user@example.com`. Each username and each email can be used only once.

**Steps to register:**

1. Click **Register** in the header (or go to `/register`).
2. Enter a username, email, password and confirm password.
3. Click **Register**. If there are errors, they are listed above the form.
4. After success you are sent to the login page with the message "Account created. Please log in."

**Steps to log in:**

1. Click **Login** in the header (or go to `/login`).
2. Enter your username and password.
3. Click **Login**. A wrong username or password shows "Invalid username or password".
4. After success you are sent to your profile page, and the menu now shows Transactions, Budgets, Goals, Profile and Logout.

**Steps to log out:**

1. Click **Logout** in the header. You are logged out and sent to the home page.

**Note:** if you are not logged in and try to open `/transactions`, `/budgets`, `/goals` or `/profile`, you are redirected to `/login`.

### 4.3 Using the CRUD web pages

All of these need login.

**Transactions (`/transactions`)**

| Action | Button or link used | What happens |
|--------|---------------------|--------------|
| Create | **+ New Transaction** button, then fill the form and click **Create** | Adds an income or expense record |
| Read | The transaction list. Use the filters (type, category, date range, keyword) and click **Search** | Shows records, totals and paging |
| Update | **Edit** link on a row, change the fields, click **Save** | Changes the record |
| Delete | **Delete** button on a row, then confirm the pop-up | Removes the record |

**Budgets (`/budgets`)**

| Action | Button or link used | What happens |
|--------|---------------------|--------------|
| Create | **+ Add Budget** button, fill the form, click **Create Budget** | Adds a budget for a month (overall or a category) |
| Read | The budget list for the month (choose a month and click **Filter**). **View dashboard** shows the monthly plan | Shows spent, remaining, percent used and warnings |
| Update | **Edit** link on a row, change the fields, click **Save Changes** | Changes the budget |
| Delete | **Delete** button on a row, then confirm | Removes the budget |

Rules to know: add the **overall budget** for the month first. Category budgets cannot add up to more than the overall budget, and the overall budget cannot be deleted while category budgets exist for that month.

**Goals (`/goals`)**

| Action | Button or link used | What happens |
|--------|---------------------|--------------|
| Create | **+ Add goal** button, fill name, target amount and optional deadline, click **Add goal** | Adds a saving goal |
| Read | The goal list. Type in the search box (click **Clear search** to reset) or choose a status | Shows progress, remaining amount and status |
| Add savings | Type an amount in the box on a row and click **Add** | Adds to the saved amount. Blocked if the net balance is negative or the amount is more than the net balance |
| Update | **Edit** link on a row, change the fields, click **Save changes** | Changes name, target or deadline. Target cannot be less than the amount already saved |
| Delete | **Delete** button on a row, then confirm | Removes the goal |

Goal status: **In progress**, **Completed** (saved amount reached the target) or **Overdue** (deadline has passed and the goal is not completed).

**Profile (`/profile`)**

1. Click **Profile** in the header.
2. Change the email, and/or fill in current password, new password and confirm new password to change the password.
3. Click **Update Profile**. A success message is shown on return.

### 4.4 Using the RESTful APIs

The APIs do not need login. Send the `userId` with each request. Every example below uses the demo user's id `6af3e71e4f0c6dd87dcd2f94` and the base address `http://localhost:8099`. Replace the ids with your own. Ids are 24-character MongoDB ids.

#### Account and profile

| Method | Path | Purpose | Body or query |
|--------|------|---------|---------------|
| POST | `/api/login` | Log in (also sets the session cookie) | body: `username`, `password` |
| POST | `/api/register` | Register a new user | body: `username`, `email`, `password`, `confirmPassword` |
| GET | `/api/profile` | Get the profile | query: `userId` |
| PUT | `/api/profile` | Change email and/or password | body: `userId`, `email`, and optionally `currentPassword`, `newPassword`, `confirmNewPassword` |

```bash
# Log in and save the session cookie
curl -i -X POST -c cookies.txt -H "Content-Type: application/json" \
  -d '{"username":"demo_user","password":"Demo_123"}' \
  http://localhost:8099/api/login

```

#### Transactions

| Method | Path | Purpose | Body or query |
|--------|------|---------|---------------|
| GET | `/api/transactions` | List transactions | query: `userId` (required), optional `type` (income or expense), `category`, `from`, `to` (YYYY-MM-DD), `keyword`, `limit` |
| GET | `/api/transactions/:id` | Get one transaction | query: `userId` |
| POST | `/api/transactions` | Create | body: `userId`, `type`, `amount`, `category`, `date` (YYYY-MM-DD), `note` |
| PUT | `/api/transactions/:id` | Update | body: same fields as POST |
| DELETE | `/api/transactions/:id` | Delete | query: `userId` |

```bash
# List all transactions (up to 5)
curl -i -X GET "http://localhost:8099/api/transactions?userId=6af3e71e4f0c6dd87dcd2f94&limit=5"

# Filter expenses by category and keyword
curl -X GET "http://localhost:8099/api/transactions?userId=6af3e71e4f0c6dd87dcd2f94&type=expense&category=shopping&keyword=lunch"

# Create
curl -X POST -H "Content-Type: application/json" \
  -d '{"userId":"6af3e71e4f0c6dd87dcd2f94","type":"expense","amount":50,"category":"food","date":"2026-11-21","note":"demo lunch"}' \
  http://localhost:8099/api/transactions

# Update (replace the id with a real transaction id)
curl -X PUT -H "Content-Type: application/json" \
  -d '{"userId":"6af3e71e4f0c6dd87dcd2f94","type":"expense","amount":60,"category":"food","date":"2026-11-21","note":"updated lunch"}' \
  http://localhost:8099/api/transactions/6afedec057731861a3906c91

# Delete
curl -X DELETE "http://localhost:8099/api/transactions/6afedec057731861a3906c91?userId=6af3e71e4f0c6dd87dcd2f94"
```

#### Budgets and monthly summary

| Method | Path | Purpose | Body or query |
|--------|------|---------|---------------|
| GET | `/api/budgets` | List budgets. With `month`, also shows spent, remaining, usagePct and warning | query: `userId` (required), `month` (YYYY-MM) |
| POST | `/api/budgets` | Create | body: `userId`, `month`, `category` (leave empty for overall budget), `amount` |
| PUT | `/api/budgets/:id` | Update | body: `userId`, `month`, `category`, `amount` |
| DELETE | `/api/budgets/:id` | Delete | query: `userId` |
| GET | `/api/reports/summary` | Monthly summary: total budget, total spent, remaining, usage %, plan | query: `userId`, `month` (both required) |

Categories for budgets are the same as for transactions.

```bash
# List budgets for a month, with usage
curl -X GET "http://localhost:8099/api/budgets?userId=6af3e71e4f0c6dd87dcd2f94&month=2026-11"

# Create a category budget (an overall budget must exist for the month first)
curl -X POST "http://localhost:8099/api/budgets" -H "Content-Type: application/json" \
  -d '{"userId":"6af3e71e4f0c6dd87dcd2f94","month":"2026-11","category":"transportation","amount":300}'

# Update
curl -X PUT "http://localhost:8099/api/budgets/6b096c987bc22eef2a74a6a3" \
  -H "Content-Type: application/json" \
  -d '{"userId":"6af3e71e4f0c6dd87dcd2f94","month":"2026-11","category":"food","amount":1000}'

# Delete
curl -X DELETE "http://localhost:8099/api/budgets/6b096c987bc22eef2a74a6a3?userId=6af3e71e4f0c6dd87dcd2f94"

# Monthly summary
curl -X GET "http://localhost:8099/api/reports/summary?userId=6af3e71e4f0c6dd87dcd2f94&month=2026-11"
```

#### Saving goals

| Method | Path | Purpose | Body or query |
|--------|------|---------|---------------|
| GET | `/api/goals` | List goals, with optional search | query: `userId` (required), `keyword`, `status` (in-progress, completed, overdue) |
| GET | `/api/goals/user/:userId` | List goals by user in the path | optional query: `keyword`, `status` |
| GET | `/api/goals/user/:userId/keyword/:keyword` | Search by name | path only |
| GET | `/api/goals/user/:userId/status/:status` | Filter by status | path only |
| GET | `/api/goals/:id` | Get one goal | query: `userId` |
| POST | `/api/goals` | Create | body: `userId`, `name`, `targetAmount`, `deadline` (optional, YYYY-MM-DD) |
| PUT | `/api/goals/:id` | Update name, target or deadline (not savedAmount) | body: `userId`, and any of `name`, `targetAmount`, `deadline` |
| DELETE | `/api/goals/:id` | Delete | query: `userId` |
| POST | `/api/goals/:id/contributions` | Add savings | body: `userId`, `amount` |

```bash
# Create a goal
curl -X POST -H "Content-Type: application/json" \
  --data '{"userId":"6af3e71e4f0c6dd87dcd2f94","name":"Japan Trip","targetAmount":1000,"deadline":"2027-03-31"}' \
  localhost:8099/api/goals

# List all goals for a user
curl -X GET "localhost:8099/api/goals?userId=6af3e71e4f0c6dd87dcd2f94"

# Search and filter
curl -X GET "localhost:8099/api/goals?userId=6af3e71e4f0c6dd87dcd2f94&keyword=trip&status=in-progress"

# Update target amount
curl -X PUT -H "Content-Type: application/json" \
  --data '{"userId":"6af3e71e4f0c6dd87dcd2f94","targetAmount":2000}' \
  localhost:8099/api/goals/6b0969de7bc22eef2a74a69f

# Add savings of 100
curl -X POST -H "Content-Type: application/json" \
  --data '{"userId":"6af3e71e4f0c6dd87dcd2f94","amount":100}' \
  localhost:8099/api/goals/6b0969de7bc22eef2a74a69f/contributions

# Delete
curl -X DELETE "localhost:8099/api/goals/6b0969de7bc22eef2a74a69f?userId=6af3e71e4f0c6dd87dcd2f94"
```

### 4.5 Quick test checklist

1. Run `npm start` and check that "MongoDB connected" and "listening at http://localhost:8099" appear.
2. Log in as `demo_user` / `Demo_123` in the browser.
3. Add a transaction, then edit and delete it.
4. Add an overall budget for the current month, then a category budget, and view the dashboard.
5. Add a goal, add savings to it, and check the status changes.
6. Run the curl commands in section 4.4 to check the APIs.

---
