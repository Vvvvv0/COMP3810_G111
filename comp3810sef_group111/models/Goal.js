const mongoose = require('mongoose');

const goalSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    targetAmount: {
      type: Number,
      required: true,
      min: [0.01, "Target amount must be greater than 0."]
    },
    currentAmount: {
      type: Number,
      required: true,
      default: 0,
      min: [0, "Current amount cannot be negative."]
    },
    targetDate: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

// Simple progress calculation
goalSchema.virtual("progressPercentage").get(function () {
  if (!this.targetAmount || this.targetAmount <= 0) return 0;

  return Math.min(
    100,
    (this.currentAmount / this.targetAmount) * 100
  );
});

goalSchema.set("toJSON", { virtuals: true });
goalSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Goal", goalSchema);