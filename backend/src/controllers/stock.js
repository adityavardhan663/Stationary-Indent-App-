const { isConnected } = require('../config/db');
const Item = require('../models/Item');
const StockTransaction = require('../models/StockTransaction');
const { mem } = require('../services/store');
const { logAction } = require('../services/auditService');

exports.stockIn = async (req, res, next) => {
  try {
    const { itemId, quantity, reference, supplier, notes } = req.body;
    const qty = Number(quantity);
    if (!itemId || !qty || qty <= 0) {
      return res.status(400).json({ message: 'Valid itemId and positive quantity are required' });
    }

    let item = null;
    let newStock = 0;

    if (isConnected()) {
      item = await Item.findByIdAndUpdate(
        itemId,
        { $inc: { stock: qty } },
        { new: true }
      );
      if (!item) return res.status(404).json({ message: 'Item not found' });
      newStock = item.stock;

      await StockTransaction.create({
        item: itemId,
        change: qty,
        type: 'STOCK_IN',
        reference: reference || supplier || 'Purchase Stock In',
        balanceAfter: newStock,
        by: req.user._id,
        at: new Date()
      });
    } else {
      const idx = mem.items.findIndex(i => i._id === itemId);
      if (idx === -1) return res.status(404).json({ message: 'Item not found' });
      mem.items[idx].stock += qty;
      newStock = mem.items[idx].stock;

      mem.stockTransactions.unshift({
        _id: 'st' + Date.now(),
        item: itemId,
        change: qty,
        type: 'STOCK_IN',
        reference: reference || supplier || 'Purchase Stock In',
        balanceAfter: newStock,
        by: req.user._id,
        at: new Date()
      });
    }

    await logAction({
      actorId: req.user._id,
      action: 'STOCK_IN',
      details: { itemId, quantity: qty, newStock, reference },
      req
    });

    res.json({
      data: {
        message: 'Stock replenished successfully',
        itemId,
        added: qty,
        newStock
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.adjustStock = async (req, res, next) => {
  try {
    const { itemId, actualStock, reason } = req.body;
    const targetStock = Number(actualStock);
    if (!itemId || targetStock === undefined || targetStock < 0) {
      return res.status(400).json({ message: 'Valid itemId and non-negative actualStock are required' });
    }

    let item = null;
    let oldStock = 0;
    let change = 0;

    if (isConnected()) {
      item = await Item.findById(itemId);
      if (!item) return res.status(404).json({ message: 'Item not found' });
      oldStock = item.stock;
      change = targetStock - oldStock;
      item.stock = targetStock;
      await item.save();

      await StockTransaction.create({
        item: itemId,
        change,
        type: 'ADJUSTMENT',
        reference: reason || 'Physical inventory audit',
        balanceAfter: targetStock,
        by: req.user._id,
        at: new Date()
      });
    } else {
      const idx = mem.items.findIndex(i => i._id === itemId);
      if (idx === -1) return res.status(404).json({ message: 'Item not found' });
      oldStock = mem.items[idx].stock;
      change = targetStock - oldStock;
      mem.items[idx].stock = targetStock;

      mem.stockTransactions.unshift({
        _id: 'st' + Date.now(),
        item: itemId,
        change,
        type: 'ADJUSTMENT',
        reference: reason || 'Physical inventory audit',
        balanceAfter: targetStock,
        by: req.user._id,
        at: new Date()
      });
    }

    await logAction({
      actorId: req.user._id,
      action: 'STOCK_ADJUSTMENT',
      details: { itemId, oldStock, newStock: targetStock, change, reason },
      req
    });

    res.json({
      data: {
        message: 'Stock adjusted successfully',
        itemId,
        change,
        newStock: targetStock
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.getLedger = async (req, res, next) => {
  try {
    const { item } = req.query;
    let transactions = [];

    if (isConnected()) {
      const query = item ? { item } : {};
      transactions = await StockTransaction.find(query)
        .populate('item', 'name code unit')
        .populate('by', 'name staffId')
        .sort({ at: -1 })
        .limit(100);
    } else {
      transactions = mem.stockTransactions
        .filter(t => !item || t.item === item)
        .map(t => {
          const it = mem.items.find(i => i._id === t.item);
          const u = mem.users.find(u => u._id === t.by);
          return {
            ...t,
            item: it ? { _id: it._id, name: it.name, code: it.code, unit: it.unit } : t.item,
            by: u ? { _id: u._id, name: u.name, staffId: u.staffId } : t.by
          };
        });
    }

    res.json({ data: transactions });
  } catch (err) {
    next(err);
  }
};
