const mongoose = require('mongoose');

const stockTransactionSchema = new mongoose.Schema({
  item: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item',
    required: true,
    index: true
  },
  change: {
    type: Number,
    required: true // Positive for stock-in, negative for issue
  },
  type: {
    type: String,
    enum: ['STOCK_IN', 'ISSUE', 'ADJUSTMENT'],
    required: true
  },
  reference: {
    type: String, // Indent number, supplier bill number, or adjustment reason
    trim: true
  },
  balanceAfter: {
    type: Number,
    required: true,
    min: 0
  },
  by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  at: {
    type: Date,
    default: Date.now,
    index: true
  }
});

stockTransactionSchema.index({ item: 1, at: -1 });

module.exports = mongoose.model('StockTransaction', stockTransactionSchema);
