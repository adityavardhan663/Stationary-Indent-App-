const { isConnected } = require('../config/db');
const Indent = require('../models/Indent');
const Item = require('../models/Item');
const StockTransaction = require('../models/StockTransaction');
const { mem } = require('../services/store');
const { logAction } = require('../services/auditService');
const { generateIndentNumber } = require('../utils/indentNumber');

exports.createIndent = async (req, res, next) => {
  try {
    const { items, confirmation, remarks } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'At least one item is required in the indent' });
    }

    const processedItems = [];

    for (const entry of items) {
      const { itemId, quantity } = entry;
      const qty = Number(quantity);
      if (!itemId || !qty || qty <= 0) {
        return res.status(400).json({ message: 'Invalid item selection or requested quantity' });
      }

      let dbItem = null;
      if (isConnected()) {
        dbItem = await Item.findById(itemId);
      } else {
        dbItem = mem.items.find(i => i._id === itemId);
      }

      if (!dbItem || !dbItem.active) {
        return res.status(400).json({ message: `Item with ID ${itemId} is unavailable or inactive` });
      }

      if (dbItem.maxPerIndent && qty > dbItem.maxPerIndent) {
        return res.status(400).json({
          message: `Requested quantity for '${dbItem.name}' (${qty}) exceeds maximum allowed per indent (${dbItem.maxPerIndent})`
        });
      }

      processedItems.push({
        item: dbItem._id,
        nameSnapshot: dbItem.name,
        unit: dbItem.unit,
        qtyRequested: qty,
        qtyIssued: 0
      });
    }

    const indentNo = generateIndentNumber();
    const confRecord = {
      method: confirmation?.method || 'biometric',
      at: confirmation?.at || new Date(),
      deviceId: confirmation?.deviceId || req.body.deviceId || 'unknown-device'
    };

    let createdIndent = null;

    if (isConnected()) {
      createdIndent = await Indent.create({
        indentNo,
        requester: req.user._id,
        department: req.user.department,
        items: processedItems,
        status: 'REQUESTED',
        confirmation: confRecord,
        remarks: remarks || ''
      });
    } else {
      createdIndent = {
        _id: 'ind' + Date.now(),
        indentNo,
        requester: req.user._id,
        department: req.user.department,
        items: processedItems,
        status: 'REQUESTED',
        confirmation: confRecord,
        remarks: remarks || '',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      mem.indents.unshift(createdIndent);
    }

    await logAction({
      actorId: req.user._id,
      action: 'INDENT_CREATE',
      details: {
        indentNo,
        itemCount: processedItems.length,
        method: confRecord.method,
        deviceId: confRecord.deviceId
      },
      req
    });

    res.status(201).json({ data: createdIndent });
  } catch (err) {
    next(err);
  }
};

exports.getMyIndents = async (req, res, next) => {
  try {
    let indents = [];
    if (isConnected()) {
      indents = await Indent.find({ requester: req.user._id })
        .populate('requester', 'name staffId department')
        .sort({ createdAt: -1 });
    } else {
      indents = mem.indents
        .filter(ind => ind.requester === req.user._id || ind.requester?._id === req.user._id)
        .map(ind => {
          const reqUser = mem.users.find(u => u._id === ind.requester);
          return {
            ...ind,
            requester: reqUser ? { _id: reqUser._id, name: reqUser.name, staffId: reqUser.staffId, department: reqUser.department } : ind.requester
          };
        });
    }

    res.json({ data: indents, total: indents.length });
  } catch (err) {
    next(err);
  }
};

exports.getAllIndents = async (req, res, next) => {
  try {
    const { status, department, search } = req.query;

    let indents = [];

    if (isConnected()) {
      const query = {};
      if (status) query.status = status;

      // HOD can only see their department unless admin/storekeeper
      if (req.user.role === 'hod') {
        query.department = req.user.department;
      } else if (department) {
        query.department = department;
      }

      if (search) {
        query.indentNo = { $regex: search, $options: 'i' };
      }

      indents = await Indent.find(query)
        .populate('requester', 'name staffId department email')
        .populate('issuedBy', 'name staffId')
        .sort({ createdAt: -1 });
    } else {
      indents = mem.indents.filter(ind => {
        if (status && ind.status !== status) return false;
        if (req.user.role === 'hod' && ind.department !== req.user.department) return false;
        if (department && ind.department !== department) return false;
        if (search && !ind.indentNo.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      }).map(ind => {
        const reqUser = mem.users.find(u => u._id === ind.requester);
        const issUser = mem.users.find(u => u._id === ind.issuedBy);
        return {
          ...ind,
          requester: reqUser ? { _id: reqUser._id, name: reqUser.name, staffId: reqUser.staffId, department: reqUser.department } : ind.requester,
          issuedBy: issUser ? { _id: issUser._id, name: issUser.name, staffId: issUser.staffId } : ind.issuedBy
        };
      });
    }

    res.json({ data: indents, total: indents.length });
  } catch (err) {
    next(err);
  }
};

exports.issueIndent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { itemsIssued, remarks } = req.body;

    let indent = null;
    if (isConnected()) {
      indent = await Indent.findById(id);
    } else {
      indent = mem.indents.find(i => i._id === id || i.indentNo === id);
    }

    if (!indent) {
      return res.status(404).json({ message: 'Indent not found' });
    }

    if (indent.status === 'ISSUED') {
      return res.status(400).json({ message: 'Indent has already been issued' });
    }
    if (indent.status === 'CANCELLED' || indent.status === 'REJECTED') {
      return res.status(400).json({ message: `Cannot issue indent with status ${indent.status}` });
    }

    // Process each item and apply atomic stock deduction
    for (const itemRecord of indent.items) {
      const override = itemsIssued?.find(o => String(o.itemId) === String(itemRecord.item));
      const issueQty = override ? Number(override.qtyIssued) : itemRecord.qtyRequested;

      if (issueQty <= 0) continue;

      if (isConnected()) {
        // Atomic stock check and reduction (Phase 8.7)
        const updateResult = await Item.updateOne(
          { _id: itemRecord.item, stock: { $gte: issueQty } },
          { $inc: { stock: -issueQty } }
        );

        if (updateResult.modifiedCount === 0) {
          return res.status(400).json({
            message: `Insufficient stock to issue item: '${itemRecord.nameSnapshot}'. Requisition aborted.`
          });
        }

        const currentItem = await Item.findById(itemRecord.item);
        itemRecord.qtyIssued = issueQty;

        // Add to stock ledger
        await StockTransaction.create({
          item: itemRecord.item,
          change: -issueQty,
          type: 'ISSUE',
          reference: indent.indentNo,
          balanceAfter: currentItem.stock,
          by: req.user._id,
          at: new Date()
        });
      } else {
        const itemIdx = mem.items.findIndex(i => i._id === itemRecord.item);
        if (itemIdx === -1) {
          return res.status(400).json({ message: `Item not found: ${itemRecord.nameSnapshot}` });
        }
        if (mem.items[itemIdx].stock < issueQty) {
          return res.status(400).json({
            message: `Insufficient stock for '${itemRecord.nameSnapshot}'. Available: ${mem.items[itemIdx].stock}, requested: ${issueQty}`
          });
        }

        mem.items[itemIdx].stock -= issueQty;
        itemRecord.qtyIssued = issueQty;

        mem.stockTransactions.unshift({
          _id: 'st' + Date.now() + Math.random(),
          item: itemRecord.item,
          change: -issueQty,
          type: 'ISSUE',
          reference: indent.indentNo,
          balanceAfter: mem.items[itemIdx].stock,
          by: req.user._id,
          at: new Date()
        });
      }
    }

    indent.status = 'ISSUED';
    indent.issuedBy = req.user._id;
    indent.issuedAt = new Date();
    if (remarks) indent.remarks = remarks;

    if (isConnected()) {
      await indent.save();
    }

    await logAction({
      actorId: req.user._id,
      action: 'INDENT_ISSUE',
      details: { indentNo: indent.indentNo, issuedBy: req.user.staffId },
      req
    });

    res.json({
      data: {
        message: `Indent ${indent.indentNo} successfully issued`,
        indent
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.cancelIndent = async (req, res, next) => {
  try {
    const { id } = req.params;
    let indent = null;

    if (isConnected()) {
      indent = await Indent.findById(id);
    } else {
      indent = mem.indents.find(i => i._id === id || i.indentNo === id);
    }

    if (!indent) return res.status(404).json({ message: 'Indent not found' });
    if (indent.status === 'ISSUED') {
      return res.status(400).json({ message: 'Cannot cancel an already issued indent' });
    }

    // Only requester or admin can cancel
    const requesterId = typeof indent.requester === 'object' ? indent.requester._id : indent.requester;
    if (String(requesterId) !== String(req.user._id) && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'You are not authorized to cancel this indent' });
    }

    indent.status = 'CANCELLED';
    if (req.body.remarks) indent.remarks = req.body.remarks;

    if (isConnected()) await indent.save();

    await logAction({
      actorId: req.user._id,
      action: 'INDENT_CANCEL',
      details: { indentNo: indent.indentNo },
      req
    });

    res.json({ data: { message: `Indent ${indent.indentNo} cancelled`, indent } });
  } catch (err) {
    next(err);
  }
};

exports.approveIndent = async (req, res, next) => {
  try {
    const { id } = req.params;
    let indent = null;

    if (isConnected()) {
      indent = await Indent.findById(id);
    } else {
      indent = mem.indents.find(i => i._id === id || i.indentNo === id);
    }

    if (!indent) return res.status(404).json({ message: 'Indent not found' });
    if (indent.status !== 'REQUESTED') {
      return res.status(400).json({ message: `Cannot approve indent with status ${indent.status}` });
    }

    indent.status = 'APPROVED';
    indent.approvedBy = req.user._id;
    indent.approvedAt = new Date();

    if (isConnected()) await indent.save();

    await logAction({
      actorId: req.user._id,
      action: 'INDENT_APPROVE',
      details: { indentNo: indent.indentNo, approvedBy: req.user.staffId },
      req
    });

    res.json({ data: { message: `Indent ${indent.indentNo} approved by HOD`, indent } });
  } catch (err) {
    next(err);
  }
};
