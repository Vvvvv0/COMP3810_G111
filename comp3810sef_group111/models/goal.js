// models/goal.js  [Member 1]  shared Goal model
// Fields: userId (string), name, targetAmount (> 0), savedAmount (>= 0), status ('active' or 'completed'), createdAt
const { ObjectId } = require('mongodb');
const COLLECTION = 'goals';

const validateGoal = (g) => {
  if (!g.name) return 'name is required';
  if (!(Number(g.targetAmount) > 0)) return 'targetAmount must be greater than 0';
  return null;
};

const findGoals = (db, filter) => db.collection(COLLECTION).find(filter).toArray();
const insertGoal = (db, doc) => db.collection(COLLECTION).insertOne({ savedAmount: 0, status: 'active', ...doc, createdAt: new Date() });
const updateGoal = (db, filter, changes) => db.collection(COLLECTION).updateOne(filter, { $set: changes });
const deleteGoal = (db, filter) => db.collection(COLLECTION).deleteOne(filter);

module.exports = { ObjectId, validateGoal, findGoals, insertGoal, updateGoal, deleteGoal };
