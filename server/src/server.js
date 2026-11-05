const config = require('./config');
const { openDatabase } = require('./db');
const createApp = require('./app');

const db = openDatabase(config.dbPath);
const app = createApp({ db, config });
const server = app.listen(config.port, () => console.log(`Shop API running on http://localhost:${config.port}`));

const stop = () => server.close(() => { db.close(); process.exit(0); });
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
