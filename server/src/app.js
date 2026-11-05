const path = require('path');
const fs = require('fs');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const defaultConfig = require('./config');
const tokenService = require('./services/tokenService');
const checkoutService = require('./services/checkoutService');
const { notFound, errorHandler } = require('./middleware/errorHandler');

function createApp({ db, config = defaultConfig }) {
  const app = express();
  const deps = { db, config, tokens: tokenService(db, config), checkout: checkoutService(db, config) };

  app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));
  app.use(cors({ origin: config.clientOrigin }));
  app.use(express.json({ limit: '50kb' }));

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/api/auth', require('./routes/auth')(deps));
  app.use('/api', require('./routes/catalog')(deps));
  app.use('/api/cart', require('./routes/cart')(deps));
  app.use('/api/orders', require('./routes/orders')(deps));
  app.use('/api/admin', require('./routes/admin')(deps));
  app.use('/api', notFound);

  // product images
  app.use('/images', express.static(path.join(__dirname, '..', 'public', 'images'), { maxAge: '7d' }));

  // In production the built React app (client/dist) is served by the same server
  const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}

module.exports = createApp;
