const { isConnected } = require('../config/db');
const Item = require('../models/Item');
const { mem } = require('../services/store');
const { logAction } = require('../services/auditService');

exports.getItems = async (req, res, next) => {
  try {
    const { search, category, active } = req.query;

    let items = [];
    if (isConnected()) {
      const query = {};
      if (active !== undefined) query.active = active === 'true';
      if (category) query.category = category;
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { code: { $regex: search, $options: 'i' } }
        ];
      }
      items = await Item.find(query).sort({ name: 1 });
    } else {
      items = mem.items.filter(item => {
        if (active !== undefined && item.active !== (active === 'true')) return false;
        if (category && item.category !== category) return false;
        if (search) {
          const s = search.toLowerCase();
          return item.name.toLowerCase().includes(s) || (item.code && item.code.toLowerCase().includes(s));
        }
        return true;
      });
    }

    res.json({ data: items });
  } catch (err) {
    next(err);
  }
};

exports.createItem = async (req, res, next) => {
  try {
    const { name, code, category, unit, stock, reorderLevel, maxPerIndent } = req.body;
    if (!name || !unit) {
      return res.status(400).json({ message: 'Item name and unit are required' });
    }

    let createdItem;
    if (isConnected()) {
      createdItem = await Item.create({
        name: name.trim(),
        code: code?.trim().toUpperCase(),
        category: category || 'General',
        unit: unit.trim(),
        stock: Number(stock) || 0,
        reorderLevel: Number(reorderLevel) || 5,
        maxPerIndent: Number(maxPerIndent) || 10,
        active: true
      });
    } else {
      createdItem = {
        _id: 'i' + Date.now(),
        name: name.trim(),
        code: code ? code.trim().toUpperCase() : 'ITM-' + Math.floor(Math.random() * 1000),
        category: category || 'General',
        unit: unit.trim(),
        stock: Number(stock) || 0,
        reorderLevel: Number(reorderLevel) || 5,
        maxPerIndent: Number(maxPerIndent) || 10,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      mem.items.push(createdItem);
    }

    await logAction({
      actorId: req.user._id,
      action: 'ITEM_CREATED',
      details: { itemId: createdItem._id, name: createdItem.name },
      req
    });

    res.status(201).json({ data: createdItem });
  } catch (err) {
    next(err);
  }
};

exports.updateItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    let updatedItem = null;
    if (isConnected()) {
      updatedItem = await Item.findByIdAndUpdate(id, updates, { new: true });
    } else {
      const idx = mem.items.findIndex(i => i._id === id);
      if (idx !== -1) {
        mem.items[idx] = { ...mem.items[idx], ...updates, updatedAt: new Date() };
        updatedItem = mem.items[idx];
      }
    }

    if (!updatedItem) {
      return res.status(404).json({ message: 'Item not found' });
    }

    await logAction({
      actorId: req.user._id,
      action: 'ITEM_UPDATED',
      details: { itemId: id, updates },
      req
    });

    res.json({ data: updatedItem });
  } catch (err) {
    next(err);
  }
};
