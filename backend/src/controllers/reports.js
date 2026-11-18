const { isConnected } = require('../config/db');
const Item = require('../models/Item');
const Indent = require('../models/Indent');
const { mem } = require('../services/store');
const { getStartOfMonth, getEndOfMonth } = require('../utils/dates');

exports.getLowStock = async (req, res, next) => {
  try {
    let lowStockItems = [];
    if (isConnected()) {
      lowStockItems = await Item.find({
        $expr: { $lte: ['$stock', '$reorderLevel'] },
        active: true
      }).sort({ stock: 1 });
    } else {
      lowStockItems = mem.items.filter(i => i.active && i.stock <= i.reorderLevel);
    }
    res.json({ data: lowStockItems, total: lowStockItems.length });
  } catch (err) {
    next(err);
  }
};

exports.getMonthlySummary = async (req, res, next) => {
  try {
    const { month } = req.query; // format YYYY-MM
    let indents = [];

    if (isConnected()) {
      const query = { status: 'ISSUED' };
      if (month) {
        query.createdAt = {
          $gte: getStartOfMonth(month),
          $lte: getEndOfMonth(month)
        };
      }
      indents = await Indent.find(query)
        .populate('requester', 'name staffId department');
    } else {
      indents = mem.indents.filter(i => {
        if (i.status !== 'ISSUED') return false;
        if (month) {
          const d = new Date(i.createdAt);
          const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          if (ym !== month) return false;
        }
        return true;
      });
    }

    const byDepartment = {};
    const byItem = {};
    let totalItemsIssued = 0;

    for (const ind of indents) {
      const dept = ind.department || 'General';
      byDepartment[dept] = (byDepartment[dept] || 0) + 1;

      for (const it of ind.items) {
        const itemName = it.nameSnapshot;
        const qty = it.qtyIssued || it.qtyRequested;
        byItem[itemName] = (byItem[itemName] || 0) + qty;
        totalItemsIssued += qty;
      }
    }

    res.json({
      data: {
        totalIndentsIssued: indents.length,
        totalItemsIssued,
        byDepartment,
        byItem
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.exportCsv = async (req, res, next) => {
  try {
    let indents = [];
    if (isConnected()) {
      indents = await Indent.find().populate('requester', 'name staffId').sort({ createdAt: -1 });
    } else {
      indents = mem.indents.map(ind => {
        const u = mem.users.find(u => u._id === ind.requester);
        return {
          ...ind,
          requester: u ? { name: u.name, staffId: u.staffId } : ind.requester
        };
      });
    }

    const headers = 'IndentNo,RequesterName,StaffID,Department,Status,CreatedAt,ItemsRequested,ConfirmationMethod\n';
    const rows = indents.map(i => {
      const reqName = i.requester?.name || 'Unknown';
      const staffId = i.requester?.staffId || '';
      const itemsSummary = (i.items || []).map(it => `${it.nameSnapshot}(${it.qtyRequested})`).join('; ');
      const method = i.confirmation?.method || 'N/A';
      const created = new Date(i.createdAt).toISOString();
      return `"${i.indentNo}","${reqName}","${staffId}","${i.department}","${i.status}","${created}","${itemsSummary}","${method}"`;
    }).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="stationery_indents_report.csv"');
    res.status(200).send(headers + rows);
  } catch (err) {
    next(err);
  }
};
