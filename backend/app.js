const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const errorHandler = require('./src/middleware/errorHandler');

const authRoutes = require('./src/routes/auth');
const itemsRoutes = require('./src/routes/items');
const stockRoutes = require('./src/routes/stock');
const indentsRoutes = require('./src/routes/indents');
const reportsRoutes = require('./src/routes/reports');
const usersRoutes = require('./src/routes/users');
const auditRoutes = require('./src/routes/audit');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'Stationery Indent Backend API',
    version: '1.0.0',
    time: new Date().toISOString()
  });
});

// Mount modular API routes
app.use('/api/auth', authRoutes);
app.use('/api', authRoutes); // Exposes /api/me and /api/me/devices per API spec
app.use('/api/items', itemsRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/indents', indentsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/audit', auditRoutes);

// 404 Fallback for unknown API routes
app.use('/api', (req, res, next) => {
  res.status(404).json({ message: `Cannot ${req.method} ${req.originalUrl}` });
});

// Central Error Handler
app.use(errorHandler);

// Serve built frontend assets if available
const path = require('path');
const fs = require('fs');
const distPath = path.join(__dirname, '../admin-web/dist');

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

module.exports = app;
