const { isConnected } = require('../config/db');
const Indent = require('../models/Indent');
const Item = require('../models/Item');
const StockTransaction = require('../models/StockTransaction');
const { mem } = require('../services/store');
const { logAction } = require('../services/auditService');
const { generateIndentNumber } = require('../utils/indentNumber');

const ALLOWED_URGENCIES = {
  urgent: 'Urgent',
  normal: 'Normal',
  'not urgent': 'Not urgent'
};

function normalizeUrgency(value) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return { provided: false, value: undefined };
  }
  if (typeof value !== 'string') {
    return { provided: true, error: 'Invalid urgency value. Allowed values: Urgent, Normal, Not urgent' };
  }
  const key = value.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  const normalized = ALLOWED_URGENCIES[key];
  if (!normalized) {
    return { provided: true, error: 'Invalid urgency value. Allowed values: Urgent, Normal, Not urgent' };
  }
  return { provided: true, value: normalized };
}

const MONTH_MAP = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  sept: 9,
  oct: 10,
  nov: 11,
  dec: 12
};

function isValidCalendarDate(year, month, day) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1) {
    return false;
  }
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= daysInMonth;
}

function normalizeNeededBy(value) {
  if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
    return { provided: false, value: undefined };
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return { provided: true, error: 'Invalid neededBy date' };
    }
    return { provided: true, value };
  }
  if (typeof value !== 'string') {
    return { provided: true, error: 'Invalid neededBy date' };
  }

  const raw = value.trim();

  // 1. ISO date-only: YYYY-MM-DD
  const isoDateMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDateMatch) {
    const year = Number(isoDateMatch[1]);
    const month = Number(isoDateMatch[2]);
    const day = Number(isoDateMatch[3]);
    if (!isValidCalendarDate(year, month, day)) {
      return { provided: true, error: 'Invalid neededBy date' };
    }
    return { provided: true, value: new Date(Date.UTC(year, month - 1, day)) };
  }

  // 2. ISO datetime: YYYY-MM-DDTHH:mm:ss(.sss)?(Z|[+-]HH:MM)
  const isoDateTimeMatch = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/
  );
  if (isoDateTimeMatch) {
    const year = Number(isoDateTimeMatch[1]);
    const month = Number(isoDateTimeMatch[2]);
    const day = Number(isoDateTimeMatch[3]);
    const hour = Number(isoDateTimeMatch[4]);
    const minute = Number(isoDateTimeMatch[5]);
    const second = Number(isoDateTimeMatch[6]);
    if (
      !isValidCalendarDate(year, month, day) ||
      hour > 23 ||
      minute > 59 ||
      second > 59
    ) {
      return { provided: true, error: 'Invalid neededBy date' };
    }
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      return { provided: true, error: 'Invalid neededBy date' };
    }
    return { provided: true, value: parsed };
  }

  // 3. Human-readable en-GB format used by mobile-app: e.g. "28 Nov 2026"
  const humanMatch = raw.match(/^(\d{1,2})\s+([A-Za-z]{3,4})\s+(\d{4})$/);
  if (humanMatch) {
    const day = Number(humanMatch[1]);
    const month = MONTH_MAP[humanMatch[2].toLowerCase()];
    const year = Number(humanMatch[3]);
    if (!month || !isValidCalendarDate(year, month, day)) {
      return { provided: true, error: 'Invalid neededBy date' };
    }
    return { provided: true, value: new Date(Date.UTC(year, month - 1, day)) };
  }

  return { provided: true, error: 'Invalid neededBy date' };
}

function normalizeOptionalText(value, fieldName) {
  if (value === undefined || value === null) {
    return { provided: false, value: undefined };
  }
  if (typeof value !== 'string') {
    return { provided: true, error: `${fieldName} must be a string` };
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return { provided: false, value: undefined };
  }
  return { provided: true, value: trimmed };
}

function parseLegacyRemarks(remarks) {
  if (typeof remarks !== 'string' || !remarks.trim()) {
    return {};
  }

  const parsed = {};
  const parts = remarks.split(/\s*\|\s*/);

  for (const part of parts) {
    const colonIdx = part.indexOf(':');
    if (colonIdx === -1) continue;

    const key = part.substring(0, colonIdx).trim().toLowerCase();
    const val = part.substring(colonIdx + 1).trim();
    if (!val) continue;

    if (key === 'urgency') {
      const res = normalizeUrgency(val);
      if (res.provided && !res.error) parsed.urgency = res.value;
    } else if (key === 'needed by' || key === 'neededby') {
      const match = val.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
      const dateStr = match ? match[1].trim() : val;
      const withinStr = match ? match[2].trim() : null;

      const dateRes = normalizeNeededBy(dateStr);
      if (dateRes.provided && !dateRes.error) parsed.neededBy = dateRes.value;
      if (withinStr) parsed.neededWithin = withinStr;
    } else if (key === 'needed within' || key === 'neededwithin') {
      parsed.neededWithin = val;
    } else if (key === 'purpose') {
      parsed.purpose = val;
    } else if (key === 'notes') {
      parsed.notes = val;
    }
  }

  return parsed;
}

exports.createIndent = async (req, res, next) => {
  try {
    const { items, confirmation, remarks, urgency, neededWithin, neededBy, purpose, notes } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'At least one item is required in the indent' });
    }

    const urgencyRes = normalizeUrgency(urgency);
    if (urgencyRes.error) {
      return res.status(400).json({ message: urgencyRes.error });
    }

    const neededByRes = normalizeNeededBy(neededBy);
    if (neededByRes.error) {
      return res.status(400).json({ message: neededByRes.error });
    }

    const neededWithinRes = normalizeOptionalText(neededWithin, 'neededWithin');
    if (neededWithinRes.error) {
      return res.status(400).json({ message: neededWithinRes.error });
    }

    const purposeRes = normalizeOptionalText(purpose, 'purpose');
    if (purposeRes.error) {
      return res.status(400).json({ message: purposeRes.error });
    }

    const notesRes = normalizeOptionalText(notes, 'notes');
    if (notesRes.error) {
      return res.status(400).json({ message: notesRes.error });
    }

    const parsedRemarks = parseLegacyRemarks(remarks);
    const optionalFields = {};

    const finalUrgency = urgencyRes.provided ? urgencyRes.value : parsedRemarks.urgency;
    const finalNeededWithin = neededWithinRes.provided ? neededWithinRes.value : parsedRemarks.neededWithin;
    const finalNeededBy = neededByRes.provided ? neededByRes.value : parsedRemarks.neededBy;
    const finalPurpose = purposeRes.provided ? purposeRes.value : parsedRemarks.purpose;
    const finalNotes = notesRes.provided ? notesRes.value : parsedRemarks.notes;

    if (finalUrgency !== undefined) optionalFields.urgency = finalUrgency;
    if (finalNeededWithin !== undefined) optionalFields.neededWithin = finalNeededWithin;
    if (finalNeededBy !== undefined) optionalFields.neededBy = finalNeededBy;
    if (finalPurpose !== undefined) optionalFields.purpose = finalPurpose;
    if (finalNotes !== undefined) optionalFields.notes = finalNotes;

    const rawDeviceId = confirmation?.deviceId ?? req.body.deviceId;
    const cleanDeviceId = typeof rawDeviceId === 'string' ? rawDeviceId.trim() : '';

    if (!cleanDeviceId) {
      await logAction({
        actorId: req.user._id,
        action: 'INDENT_CREATE_DENIED',
        details: { reason: 'Missing deviceId' },
        req
      });
      return res.status(403).json({
        message: 'A registered and approved device is required to create an indent'
      });
    }

    const userDevices = Array.isArray(req.user?.devices) ? req.user.devices : [];
    const registeredDevice = userDevices.find(d => d.deviceId === cleanDeviceId);

    if (!registeredDevice) {
      await logAction({
        actorId: req.user._id,
        action: 'INDENT_CREATE_DENIED',
        details: { reason: 'Unknown or unowned device', deviceId: cleanDeviceId },
        req
      });
      return res.status(403).json({
        message: 'Device is not registered to the authenticated user'
      });
    }

    if (registeredDevice.approved !== true) {
      await logAction({
        actorId: req.user._id,
        action: 'INDENT_CREATE_DENIED',
        details: { reason: 'Unapproved device', deviceId: cleanDeviceId },
        req
      });
      return res.status(403).json({
        message: 'Device is not approved by an administrator'
      });
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
      deviceId: cleanDeviceId
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
        ...optionalFields,
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
        ...optionalFields,
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

    // 1. Validation pass: Ensure ALL items have sufficient stock before deducting anything
    const plan = [];
    for (const itemRecord of indent.items) {
      const override = itemsIssued?.find(o => String(o.itemId) === String(itemRecord.item));
      const issueQty = override ? Number(override.qtyIssued) : itemRecord.qtyRequested;

      if (issueQty <= 0) continue;

      if (isConnected()) {
        const dbItem = await Item.findById(itemRecord.item);
        if (!dbItem) {
          return res.status(400).json({ message: `Item not found: ${itemRecord.nameSnapshot}` });
        }
        if (dbItem.stock < issueQty) {
          return res.status(400).json({
            message: `Insufficient stock for '${itemRecord.nameSnapshot}'. Available: ${dbItem.stock}, requested: ${issueQty}`
          });
        }
        plan.push({ itemRecord, issueQty });
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
        plan.push({ itemRecord, itemIdx, issueQty });
      }
    }

    // 2. Execution pass: Apply deductions and record stock transactions
    for (const entry of plan) {
      const { itemRecord, issueQty } = entry;

      if (isConnected()) {
        const updateResult = await Item.updateOne(
          { _id: itemRecord.item, stock: { $gte: issueQty } },
          { $inc: { stock: -issueQty } }
        );

        if (updateResult.modifiedCount === 0) {
          return res.status(400).json({
            message: `Concurrent inventory conflict for '${itemRecord.nameSnapshot}'. Requisition aborted.`
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
        const { itemIdx } = entry;
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

exports.rejectIndent = async (req, res, next) => {
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
      return res.status(400).json({ message: `Cannot reject indent with status ${indent.status}` });
    }

    indent.status = 'REJECTED';
    indent.remarks = req.body?.remarks || indent.remarks || 'Rejected by Department Head';

    if (isConnected()) await indent.save();

    await logAction({
      actorId: req.user._id,
      action: 'INDENT_REJECT',
      details: { indentNo: indent.indentNo, rejectedBy: req.user.staffId, remarks: indent.remarks },
      req
    });

    res.json({ data: { message: `Indent ${indent.indentNo} rejected`, indent } });
  } catch (err) {
    next(err);
  }
};
