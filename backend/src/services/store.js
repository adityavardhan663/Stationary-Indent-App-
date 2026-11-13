const bcrypt = require('bcryptjs');
const { isConnected } = require('../config/db');
const User = require('../models/User');
const Item = require('../models/Item');
const Indent = require('../models/Indent');
const StockTransaction = require('../models/StockTransaction');
const AuditLog = require('../models/AuditLog');
const { generateIndentNumber } = require('../utils/indentNumber');

// In-memory collections used when MongoDB Atlas is not yet connected
const mem = {
  users: [],
  items: [],
  indents: [],
  stockTransactions: [],
  auditLogs: []
};

// Seed initial memory data
async function initSeed() {
  const defaultPasswordHash = await bcrypt.hash('Password@123', 10);

  const initialUsers = [
    {
      _id: 'u001',
      staffId: 'EMP001',
      name: 'Dr. Ramesh Sharma (Admin)',
      department: 'Administration',
      role: 'admin',
      passwordHash: defaultPasswordHash,
      mustChangePassword: false,
      email: 'admin@college.edu',
      phone: '+91 9876543201',
      devices: [{ deviceId: 'dev-admin-pc', label: 'Admin Workstation', approved: true, registeredAt: new Date() }],
      active: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      _id: 'u002',
      staffId: 'SK001',
      name: 'Rajesh Kumar (Storekeeper)',
      department: 'Central Stores',
      role: 'storekeeper',
      passwordHash: defaultPasswordHash,
      mustChangePassword: false,
      email: 'stores@college.edu',
      phone: '+91 9876543202',
      devices: [{ deviceId: 'dev-store-tab', label: 'Counter Tablet', approved: true, registeredAt: new Date() }],
      active: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      _id: 'u003',
      staffId: 'HOD01',
      name: 'Dr. Ananya Rao (HOD CSE)',
      department: 'Computer Science',
      role: 'hod',
      passwordHash: defaultPasswordHash,
      mustChangePassword: false,
      email: 'hod.cse@college.edu',
      phone: '+91 9876543203',
      devices: [{ deviceId: 'dev-hod-phone', label: 'Pixel 8', approved: true, registeredAt: new Date() }],
      active: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      _id: 'u004',
      staffId: 'FAC101',
      name: 'Prof. Aditya Verma',
      department: 'Computer Science',
      role: 'faculty',
      passwordHash: defaultPasswordHash,
      mustChangePassword: false,
      email: 'aditya.v@college.edu',
      phone: '+91 9876543210',
      devices: [{ deviceId: 'dev-phone-aditya', label: 'OnePlus 11', approved: true, registeredAt: new Date() }],
      active: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      _id: 'u005',
      staffId: 'FAC102',
      name: 'Dr. Meera Patel',
      department: 'Mechanical Engineering',
      role: 'faculty',
      passwordHash: defaultPasswordHash,
      mustChangePassword: false,
      email: 'meera.p@college.edu',
      phone: '+91 9876543220',
      devices: [{ deviceId: 'dev-phone-meera', label: 'Samsung S22', approved: true, registeredAt: new Date() }],
      active: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  const initialItems = [
    {
      _id: 'i001',
      name: 'A4 Copier Paper 75GSM',
      code: 'PAP-A4-75',
      category: 'Paper',
      unit: 'ream',
      stock: 85,
      reorderLevel: 20,
      maxPerIndent: 5,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      _id: 'i002',
      name: 'Blue Ballpoint Pen (Box of 20)',
      code: 'PEN-BLU-20',
      category: 'Writing',
      unit: 'box',
      stock: 35,
      reorderLevel: 10,
      maxPerIndent: 3,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      _id: 'i003',
      name: 'Black Gel Pen (Box of 10)',
      code: 'PEN-BLK-10',
      category: 'Writing',
      unit: 'box',
      stock: 18,
      reorderLevel: 10,
      maxPerIndent: 2,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      _id: 'i004',
      name: 'Red Marking Pen (Box of 10)',
      code: 'PEN-RED-10',
      category: 'Writing',
      unit: 'box',
      stock: 6,
      reorderLevel: 10,
      maxPerIndent: 2,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      _id: 'i005',
      name: 'Box File (Spring Type)',
      code: 'FIL-BOX-01',
      category: 'Filing',
      unit: 'piece',
      stock: 45,
      reorderLevel: 15,
      maxPerIndent: 10,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      _id: 'i006',
      name: 'Whiteboard Marker Set (4 Colors)',
      code: 'MRK-WB-SET',
      category: 'Writing',
      unit: 'set',
      stock: 8,
      reorderLevel: 15,
      maxPerIndent: 4,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      _id: 'i007',
      name: 'Heavy Duty Stapler',
      code: 'STP-HD-01',
      category: 'Office Supplies',
      unit: 'piece',
      stock: 12,
      reorderLevel: 5,
      maxPerIndent: 2,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      _id: 'i008',
      name: 'Stapler Pins 24/6 (Pack of 10 boxes)',
      code: 'PIN-STP-24',
      category: 'Office Supplies',
      unit: 'packet',
      stock: 60,
      reorderLevel: 15,
      maxPerIndent: 5,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      _id: 'i009',
      name: 'Post-it Sticky Notes (Yellow 3x3)',
      code: 'NOT-STK-YEL',
      category: 'Paper',
      unit: 'pad',
      stock: 25,
      reorderLevel: 10,
      maxPerIndent: 5,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      _id: 'i010',
      name: 'Correction Tape (5mm x 6m)',
      code: 'COR-TAP-01',
      category: 'Office Supplies',
      unit: 'piece',
      stock: 4,
      reorderLevel: 10,
      maxPerIndent: 3,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  mem.users = initialUsers;
  mem.items = initialItems;

  mem.indents = [
    {
      _id: 'ind001',
      indentNo: 'IND-2026-000101',
      requester: 'u004', // Prof. Aditya
      department: 'Computer Science',
      items: [
        { item: 'i001', nameSnapshot: 'A4 Copier Paper 75GSM', unit: 'ream', qtyRequested: 2, qtyIssued: 0 },
        { item: 'i006', nameSnapshot: 'Whiteboard Marker Set (4 Colors)', unit: 'set', qtyRequested: 1, qtyIssued: 0 }
      ],
      status: 'REQUESTED',
      confirmation: {
        method: 'biometric',
        at: new Date(Date.now() - 3600000 * 2),
        deviceId: 'dev-phone-aditya'
      },
      remarks: 'For mid-term exam review sessions',
      createdAt: new Date(Date.now() - 3600000 * 2),
      updatedAt: new Date(Date.now() - 3600000 * 2)
    },
    {
      _id: 'ind002',
      indentNo: 'IND-2026-000100',
      requester: 'u005', // Dr. Meera
      department: 'Mechanical Engineering',
      items: [
        { item: 'i002', nameSnapshot: 'Blue Ballpoint Pen (Box of 20)', unit: 'box', qtyRequested: 1, qtyIssued: 1 },
        { item: 'i005', nameSnapshot: 'Box File (Spring Type)', unit: 'piece', qtyRequested: 4, qtyIssued: 4 }
      ],
      status: 'ISSUED',
      confirmation: {
        method: 'biometric',
        at: new Date(Date.now() - 86400000),
        deviceId: 'dev-phone-meera'
      },
      issuedBy: 'u002',
      issuedAt: new Date(Date.now() - 86400000 + 1800000),
      remarks: 'Lab record filing',
      createdAt: new Date(Date.now() - 86400000),
      updatedAt: new Date(Date.now() - 86400000 + 1800000)
    }
  ];

  mem.stockTransactions = [
    {
      _id: 'st001',
      item: 'i001',
      change: 85,
      type: 'STOCK_IN',
      reference: 'Opening Inventory Verification',
      balanceAfter: 85,
      by: 'u002',
      at: new Date(Date.now() - 86400000 * 7)
    },
    {
      _id: 'st002',
      item: 'i002',
      change: -1,
      type: 'ISSUE',
      reference: 'IND-2026-000100',
      balanceAfter: 35,
      by: 'u002',
      at: new Date(Date.now() - 86400000 + 1800000)
    }
  ];

  mem.auditLogs = [
    {
      _id: 'a001',
      actor: 'u001',
      action: 'SYSTEM_BOOTSTRAP',
      details: { message: 'Database initialized with demo stationery catalog and role accounts' },
      ip: '127.0.0.1',
      userAgent: 'Stationery-Indent-App/1.0',
      at: new Date()
    }
  ];

  // If MongoDB is connected, also mirror seed to MongoDB if collections are empty
  if (isConnected()) {
    try {
      const userCount = await User.countDocuments();
      if (userCount === 0) {
        console.log('[Seed] Syncing seed data to MongoDB Atlas collections...');
        await User.insertMany(initialUsers.map(u => ({ ...u, _id: undefined })));
        await Item.insertMany(initialItems.map(i => ({ ...i, _id: undefined })));
        console.log('[Seed] MongoDB Atlas synced successfully.');
      }
    } catch (err) {
      console.warn('[Seed Warning] MongoDB sync deferred:', err.message);
    }
  }
}

initSeed();

module.exports = {
  mem,
  initSeed
};
