// models/user.js [Member 2] shared User model
// Fields: username (unique), password, createdAt
const COLLECTION = 'users';

const findUser = (db, filter) => db.collection(COLLECTION).findOne(filter);

const insertUser = (db, doc) =>
  db.collection(COLLECTION).insertOne({ ...doc, createdAt: new Date() });

module.exports = { findUser, insertUser };
