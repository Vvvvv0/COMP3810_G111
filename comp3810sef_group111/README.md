# Personal Expense and Budget Tracker

COMP 3810SEF Autumn 2026 - Group Project - Group 111

---

## 1. Project info

**Project name:** Personal Expense and Budget Tracker

**Purpose:** A server-side web application that helps a person keep control of their money. A registered user can:

- log in and out, and manage their own profile;
- record income and expense transactions, and search them by type, category and date ;
- set monthly budgets and compare them with real spending, with a dashboard summary ;
- create saving goals, add savings, and follow the progress and status of each goal.

All data belongs to the logged-in user. The server also offers RESTful services, which can be tested with `curl`.

**Technologies:** Node.js (18 or later), Express.js, EJS templates, MongoDB (Atlas) with the MongoDB Node.js driver, `cookie-session` for login sessions.

---

## 2. Group info

**Group no.:** 111

| No. | Name | SID |
|---|---|---|
| 1 | Fung Wing Kei | 13874134 |
| 2 | Chung Ka Ki | 13875708 |
| 3 | Chau Wai Ming | 13874632 |
| 4 | Chen Si Wei | 13772098 |

**Workload division**

| No. | Member | Work role |
|---|---|---|
| 1 | Fung Wing Kei (13874134) | Project foundation (`server.js`, `package.json`, models), request logger, home page, saving goals (pages and REST API), integration, testing and packaging |
| 2 | Chung Ka Ki (13875708) | Registration, login, logout, password rules, session protection (`requireLogin`), profile (pages and REST API), integration |
| 3 | Chau Wai Ming (13874632) | Transactions: create, read/search/filter, update, delete (pages and REST API), calculation helpers |
| 4 | Chen Si Wei (13772098) | Budgets: create, read, update, delete (pages and REST API), budget usage, dashboard, summary API |

---

## 3. Project file introduction

```
comp3810sef_group111/
├── server.js
├── package.json
├── README.md
├── middleware/
│   └── auth.js
├── models/
│   ├── user.js
│   ├── transaction.js
│   ├── budget.js
│   └── goal.js
├── routes/
│   ├── auth.js
│   ├── profile.js
│   ├── transactions.js
│   ├── budgets.js
│   └── goals.js
├── views/
│   ├── home/        (index.ejs, home.ejs)
│   ├── auth/        (login.ejs, register.ejs)
│   ├── profile/     (profile.ejs)
│   ├── goals/       (list.ejs, form.ejs)
│   ├── transactions/(edit.ejs, list.ejs, new.ejs)
│   ├── budgets/     (dashboard.ejs, form.ejs, list.ejs)  
└── public/
    └── style.css
```

| File or folder | What it contains |
|---|---|
| `server.js` | Starts the application: connects to MongoDB, sets up EJS, JSON and form parsing, the request logger (date, method, path, status), `cookie-session`, the password and e-mail rules, and the `requireLogin` check. It mounts every router, then the 404 page and the error handler, and listens on port 8099. |
| `package.json` | Project name, the `npm start` script, and the dependencies: `express`, `ejs`, `mongodb`, `cookie-session`. |
| `models/` | Data-access functions for each MongoDB collection (`users`, `transactions`, `budgets`, `goals`). They contain no routes. `goal.js` also holds the goal checks and the progress and status calculation. |
| `routes/` | One file per feature. Each exports two routers: `pages` (EJS pages, login required) and `api` (RESTful services). `auth.js` = home, register, login, logout and the register/login APIs. `profile.js` = profile page and API. `goals.js` = saving goals. `transactions.js` and `budgets.js` = Members 3 and 4. |
| `middleware/auth.js` | A login check with the same rule as `requireLogin` in `server.js`. |
| `views/` | EJS templates. `home/index.ejs` is the shared header (navigation and Logout link) and `home/footer.ejs` is the shared footer. `home/home.ejs` is the home page. |
| `public/style.css` | The stylesheet for all pages. |

---

## 4. Operation guides

### 4.1 Start the server

1. Install Node.js 18 or later. An internet connection is needed, because the database is MongoDB Atlas.
2. In the project folder, run:
   ```
   npm install
   npm start
   ```
3. Wait for `MongoDB connected` and `Server listening on PORT 8099`.
4. Open http://localhost:8099/ in a browser.

The database connection string is in `server.js`. The database is called `COMP3810sef`.

### 4.2 Login and logout

**Valid login (demo account):**

| Username | Password |
|---|---|
| `demo_user` | `Demo@1234` |


**Register**

1. Open http://localhost:8099/register (or click **Register** in the top bar).
2. Enter a username, an e-mail, a password and the same password again, then submit.
3. Password rules: at least 8 characters, no spaces, at least one lowercase letter, one uppercase letter, one digit and one special character, and it must not contain the username. The username and the e-mail must not already be used.
4. After a successful registration you are sent to the login page.

**Login**

1. Open http://localhost:8099/login (or click **Login**).
2. Enter the username and password, then submit. On success you go to your profile page. A wrong username or password shows "Invalid username or password".

**Protected pages:** the profile, goals, transactions and budgets pages need a login. A visitor who is not logged in is sent to the login page.

**Logout:** click **Logout** in the top bar (it opens `/logout`). The session is cleared and you return to the home page.

### 4.3 CRUD web pages

The top bar shows the links **Transactions, Budgets, Goals, Profile, Logout** after login.

| Function | Button or UI |
|---|---|
| **Create** | *(button / page name)* |
| **Read / search** | *(search form: type, category, date range)* |
| **Update** | *(button / page name)* |
| **Delete** | *(button name)* |

**Budgets and dashboard** (`/budgets`, `/dashboard`) -  (Member 4): fill in before submission**

| Function | Button or UI |
|---|---|
| **Create** | "+ Add Budget" button on `/budgets` opens `/budgets/new`; enter month (`YYYY-MM`), optional category (blank = overall monthly budget) and amount, then press Save.|
| **Read** | `/budgets` shows a Month filter (defaults to the current month) and a table with Category, Budget, Spent, Remaining, Usage and Actions. The Dashboard link opens `/budgets/dashboard`, which lists the same usage for every budget of the month.|
| **Update** | Each row has an Edit button that opens `/budgets/:id/edit`; change category or amount then press Save. |
| **Delete** | Each row has a Delete button that submits to `/budgets/:id/delete` and removes that budget. |

**Saving goals** (`/goals`)

| Function | Button or UI |
|---|---|
| **Create** | **+ Add goal** button on the goals page opens `/goals/new`. Enter the goal name, target amount and an optional deadline, then press **Add goal**. |
| **Read** | The goals page lists the user's goals, newest first. Each row shows a progress bar, saved / target amount, remaining amount, deadline and a status badge (In progress, Completed or Overdue). Four cards show the number of goals, completed goals, total saved and total target. |
| **Update** | **Edit** link on a goal changes its name, target or deadline. The amount **Add** box on a goal adds savings to it. |
| **Delete** | **Delete** button on a goal (a confirmation box appears). |

**Profile** (`/profile`)

| Function | Button or UI |
|---|---|
| **Read** | The profile page shows username, e-mail and display name. |
| **Update** | Change the e-mail or display name, or change the password (current password, new password, confirmation), then save. |

**Transactions** (`/transactions`) - **TODO (Member 3): fill in before submission**

### 4.4 RESTful CRUD services

The APIs return JSON. Test them from a **second terminal** while the server runs in the first one. The examples use `localhost:8099`.

**How the user is identified.** The goals, transactions and budgets APIs need no login: the owner is given with `userId` (in the query string for GET and DELETE, in the JSON body for POST and PUT). The `userId` is returned by the register and login APIs. The profile APIs do need a login: log in first with `-c cookies.txt`, then send the saved cookie with `-b cookies.txt`.

| Method | Path | Purpose | Login needed |
|---|---|---|---|
| POST | `/api/register` | Create a user | No |
| POST | `/api/login` | Log in, returns `userId`, sets the session cookie | No |
| GET | `/api/profile?userId=...` | Read own profile | Yes (cookie) |
| PUT | `/api/profile` | Update own profile | Yes (cookie) |
| GET | `/api/goals?userId=...` | List goals with progress | No |
| POST | `/api/goals` | Create a goal | No |
| PUT | `/api/goals/:id` | Update a goal | No |
| DELETE | `/api/goals/:id?userId=...` | Delete a goal | No |
| POST | `/api/goals/:id/contributions` | Add savings to a goal | No |
| *TODO* | *transactions: GET, POST, PUT, DELETE under `/api/transactions`* | *(Member 3)* | No |
| *TODO* | *budgets: GET, POST, PUT, DELETE under `/api/budgets`; summary* | *(Member 4)* | No |

Replace `ID` with a `userId` and `GID` with a goal's `_id` (returned when the goal is created).

#### User APIs 

```
# CREATE - register
curl -X POST -H "Content-Type: application/json" --data '{"username":"demo_user","email":"demo@example.com","password":"Demo@1234","confirmPassword":"Demo@1234"}' localhost:8099/api/register

# Log in and save the session cookie
curl -c cookies.txt -X POST -H "Content-Type: application/json" --data '{"username":"demo_user","password":"Demo@1234"}' localhost:8099/api/login

# READ - own profile (needs the cookie)
curl -b cookies.txt -X GET "localhost:8099/api/profile?userId=ID"

# UPDATE - own profile (send email and displayName)
curl -b cookies.txt -X PUT -H "Content-Type: application/json" --data '{"userId":"ID","email":"demo@example.com","displayName":"Demo User"}' localhost:8099/api/profile
```

Replies: register `201 {"message":"User registered successfully","userId":"..."}`; login `200 {"message":"Login successful","userId":"..."}`; profile without a login `401 {"error":"Please log in first"}`; weak password or duplicate user `400 {"error":...}`; wrong login `401 {"error":"Invalid username or password"}`.

#### Goals APIs 

```
# CREATE
curl -X POST -H "Content-Type: application/json" --data '{"userId":"ID","name":"Japan Trip","targetAmount":1000,"deadline":"2027-03-31"}' localhost:8099/api/goals

# READ - list goals (each with percent, remaining, statusLabel)
curl -X GET "localhost:8099/api/goals?userId=ID"

# UPDATE - send only what changes (name, targetAmount, deadline)
curl -X PUT -H "Content-Type: application/json" --data '{"userId":"ID","targetAmount":2000}' localhost:8099/api/goals/GID

# ADD SAVINGS
curl -X POST -H "Content-Type: application/json" --data '{"userId":"ID","amount":250}' localhost:8099/api/goals/GID/contributions

# DELETE
curl -X DELETE "localhost:8099/api/goals/GID?userId=ID"
```

Replies: create `201`, update `200`, add savings `201` with `reachedTarget` true or false, delete `200 {"message":"Goal deleted"}`. A goal that does not exist or belongs to another user gives `404`. A wrong id, a missing `userId` or an invalid amount gives `400`. The saved amount cannot be changed with PUT, only through contributions.

Run the commands in this order: create (copy the `_id` from the reply as `GID`), read, update, add savings, delete.

#### Transactions APIs - TODO

*Add the paths, the request body and the curl command for each of GET, POST, PUT and DELETE.*

#### Budgets APIs 



Paths: `GET /api/budgets`, `POST /api/budgets`, `PUT /api/budgets/:id`,
`DELETE /api/budgets/:id`, `GET /api/transactions/:id`, `GET /api/reports/summary`.
Replace ID with a userId, BID with a budget's `_id` and TID with a transaction's `_id`.

```
# CREATE budget
curl -X POST -H "Content-Type: application/json" --data '{"userId":"ID","month":"2026-11","category":"food","amount":500}' localhost:8099/api/budgets

# READ - list budgets for a month
curl -X GET "localhost:8099/api/budgets?userId=ID&month=2026-11"

# UPDATE - send the month, category and the new amount
curl -X PUT -H "Content-Type: application/json" --data '{"userId":"ID","month":"2026-11","category":"food","amount":800}' localhost:8099/api/budgets/BID

# DELETE
curl -X DELETE "localhost:8099/api/budgets/BID?userId=ID"

# TRANSACTION DETAILS - one record, 404 if it is not the user's
curl -X GET "localhost:8099/api/transactions/TID?userId=ID"

# MONTHLY SUMMARY - total budget, spent, remaining and usage percent
curl -X GET "localhost:8099/api/reports/summary?userId=ID&month=2026-11"

```
Replies: create 201, read / transaction detail / summary 200, update and delete 200 {"ok":true}. A missing userId or an invalid amount gives 400; an id that does not exist or belongs to another user gives 404; a duplicate user + month + category gives 409.



## 5. Notes

- Passwords are stored as plain text in the database, by design for this course project. Password rules and input checks are enforced instead.
- Every web page query is limited to the logged-in user (`userId` from the session), so a user cannot see or change another user's records.
- A request to an unknown address returns `404 Not Found`. An error in the server returns a short error message, and the details are printed in the server terminal.
