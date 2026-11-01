const mongoose = require('mongoose');

const budgetSchema = new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  month:    { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ },
  category: { type: String, required: true,
              enum: ['overall', 'food', 'transport', 'shopping', 'housing',
                     'entertainment', 'health', 'education', 'other'] },
  limit:    { type: Number, required: true, min: 0.01 }
});

// One budget per user, month and category
budgetSchema.index({ userId: 1, month: 1, category: 1 }, { unique: true });

module.exports = mongoose.model('Budget', budgetSchema);
