import { config } from './config.js';
import { openDatabase } from './db.js';
import { createApp } from './app.js';

const db = openDatabase();
const app = createApp(db);

const server = app.listen(config.port, () => {
  console.log(`VIT Lost & Found API running at http://localhost:${config.port}`);
  console.log(`Database: ${config.dbFile}`);
});

const shutdown = () => {
  server.close(() => {
    db.close();
    process.exit(0);
  });
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
