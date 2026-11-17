// models/transaction.js  [Member 3]  shared Transaction model
// Fields: userId (string), type ('income' or 'expense'), amount (> 0), category, date (Date), note, createdAt
const { ObjectId } = require('mongodb');
const COLLECTION = 'transactions';

// Returns an error message, or null if the record is valid
const validateTransaction = (t) => {
  if (t.type !== 'income' && t.type !== 'expense') return 'type must be income or expense';
  if (!(Number(t.amount) > 0)) return 'amount must be greater than 0';
  if (!t.category) return 'category is required';
  return null;
};

const findTransactions = (db, filter) => db.collection(COLLECTION).find(filter).toArray();
const insertTransaction = (db, doc) => db.collection(COLLECTION).insertOne({ ...doc, createdAt: new Date() });
const updateTransaction = (db, filter, changes) => db.collection(COLLECTION).updateOne(filter, { $set: changes });
const deleteTransaction = (db, filter) => db.collection(COLLECTION).deleteOne(filter);

module.exports = { ObjectId, validateTransaction, findTransactions, insertTransaction, updateTransaction, deleteTransaction };
