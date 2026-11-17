# G111---Personal-Expense-and-Budget-Tracker
**Project info:**
Personal Expense and Budget Tracker: 

**Group info:**

Group no. 111 

Student name with SID:

1. Fung Wing Kei (13874134)
2. Chung Ka Ki (13875708)
3. Chau Wai Ming (13874632)
4. Chen Si Wei (13772098)

Workload division:
1. Fung Wing Kei (13874134) - 
2. Chung Ka Ki (13875708)
3. Chau Wai Ming (13874632)
4. Chen Si Wei (13772098)

**Project file intro:**
server.js:
package.json:
public:
views:
models:

**Operational guides:**

**User guide**
command:
1. npm install
2. npm start

**Demo curl command**
goal commands:

curl -X POST -H "Content-Type: application/json" --data '{"userId":"6af3e71e4f0c6dd87dcd2f94","name":"Japan Trip","targetAmount":1000,"deadline":"2027-03-31"}' localhost:8099/api/goals

curl -X GET "localhost:8099/api/goals?userId=6af3e71e4f0c6dd87dcd2f94"

curl -X PUT -H "Content-Type: application/json" --data '{"userId":"6af3e71e4f0c6dd87dcd2f94","targetAmount":2000}' localhost:8099/api/goals/6afc08dce784c3f2a71496b9

curl -X POST -H "Content-Type: application/json" --data '{"userId":"6af3e71e4f0c6dd87dcd2f94","amount":250}' localhost:8099/api/goals/6afc08dce784c3f2a71496b9/contributions

curl -X DELETE "localhost:8099/api/goals/6afc08dce784c3f2a71496b9?userId=6af3e71e4f0c6dd87dcd2f94"