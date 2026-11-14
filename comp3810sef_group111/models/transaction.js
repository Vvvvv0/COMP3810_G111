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

const CATEGORIES = [
  'food', 'transportation', 'shopping', 'entertainment',
  'housing', 'health', 'education', 'salary', 'other'
];

const dateRange = ({ from, to }) => {
  if (!from && !to) return null;
  const range = {};
  if (from) range.$gte = new Date(from);
  if (to) {
    const end = new Date(to);
    end.setDate(end.getDate() + 1);
    range.$lt = end;
  }
  return range;
};

const buildFilter = (query = {}) => {
  const filter = {};
  if (query.userId) filter.userId = String(query.userId);
  if (query.type) filter.type = query.type;
  if (query.category) filter.category = query.category;
  const range = dateRange(query);
  if (range) filter.date = range;
  if (query.keyword) filter.note = { $regex: String(query.keyword), $options: 'i' };
  return filter;
};

const findTransactionById = (db, id) => {
  if (!ObjectId.isValid(id)) return null;
  return db.collection(COLLECTION).findOne({ _id: new ObjectId(id) });
};

const sumByType = async (db, userId, { from, to } = {}) => {
  const match = { userId: String(userId) };
  const range = dateRange({ from, to });
  if (range) match.date = range;
  const rows = await db.collection(COLLECTION).aggregate([
    { $match: match },
    { $group: { _id: '$type', total: { $sum: '$amount' } } }
  ]).toArray();
  const result = { income: 0, expense: 0 };
  rows.forEach(r => { result[r._id] = r.total; });
  return result;
};

const sumExpenseByCategory = async (db, userId, { from, to } = {}) => {
  const match = { userId: String(userId), type: 'expense' };
  const range = dateRange({ from, to });
  if (range) match.date = range;
  return db.collection(COLLECTION).aggregate([
    { $match: match },
    { $group: { _id: '$category', total: { $sum: '$amount' } } },
    { $project: { _id: 0, category: '$_id', total: 1 } },
    { $sort: { total: -1 } }
  ]).toArray();
};

const sumByMonth = async (db, userId, year) => {
  const start = new Date(year, 0, 1);
  const end = new Date(year + 1, 0, 1);
  return db.collection(COLLECTION).aggregate([
    { $match: { userId: String(userId), date: { $gte: start, $lt: end } } },
    { $group: {
        _id: { month: { $month: '$date' }, type: '$type' },
        total: { $sum: '$amount' }
      }
    },
    { $sort: { '_id.month': 1 } }
  ]).toArray();
};

module.exports = {
  ObjectId, validateTransaction, findTransactions, insertTransaction, updateTransaction, deleteTransaction,
  CATEGORIES, buildFilter, findTransactionById,
  sumByType, sumExpenseByCategory, sumByMonth
};
