const cluster = require('cluster');
const os = require('os');
const path = require('path');

const WORKERS = Math.min(os.cpus().length, 4); // cap at 4 to avoid DB connection explosion

if (cluster.isPrimary) {
  console.log(`Primary ${process.pid} starting ${WORKERS} workers`);

  // Run one-time startup tasks in primary only
  require('dotenv').config({ path: path.join(__dirname, 'src/../.env') });
  const connectDB = require('./src/utils/database');
  connectDB().then(() => {
    const { initializeDefaultSettings } = require('./src/controllers/settingsController');
    setTimeout(() => initializeDefaultSettings(), 1000);
  });

  for (let i = 0; i < WORKERS; i++) cluster.fork({ CLUSTER_WORKER: '1' });
  cluster.on('exit', (worker, code) => {
    console.log(`Worker ${worker.process.pid} died (code ${code}), restarting...`);
    cluster.fork({ CLUSTER_WORKER: '1' });
  });
} else {
  require(path.join(__dirname, 'src/server.js'));
  console.log(`Worker ${process.pid} started`);
}
