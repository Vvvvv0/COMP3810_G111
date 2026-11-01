const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type:      { type: String, enum: ['income', 'expense'], required: true },
  amount:    { type: Number, required: true, min: 0.01 },
  category:  { type: String, required: true,
               enum: ['food', 'transport', 'shopping', 'housing', 'entertainment',
                      'health', 'education', 'other', 'salary', 'bonus', 'investment'] },
  date:      { type: Date, required: true },
  note:      { type: String, default: '', maxlength: 200 },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Transaction', transactionSchema);
