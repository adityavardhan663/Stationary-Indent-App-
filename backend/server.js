require('dotenv').config();
const app = require('./app');
const { connectDB } = require('./src/config/db');

const PORT = process.env.PORT || 5000;

async function startServer() {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(` Stationery Indent App - Backend API Server           `);
    console.log(` Running on: http://localhost:${PORT}                 `);
    console.log(` Health check: http://localhost:${PORT}/api/health     `);
    console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`=======================================================`);
  });
}

startServer();
