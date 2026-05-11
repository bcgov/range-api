import type { Application, ErrorRequestHandler } from 'express';
import compression from 'compression';
import express from 'express';
import { logger } from './libs/bcgov-shim.js';
import initPassport from './libs/authmware.js';
import initRouter from './router/index.js';

async function createApp(): Promise<Application> {
  const app = express();
  const options = {
    inflate: true,
    limit: '30000kb',
    type: 'image/*',
  };

  app.use(compression());
  app.use(
    express.urlencoded({
      extended: true,
    }),
  );
  app.use(express.json({ limit: '99999kb' }));
  app.use(express.raw(options));

  await initPassport(app);

  initRouter(app);

  const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
    logger.error(err.message);
    let code = 500;
    if (typeof err.code === 'number' && err.code >= 100 && err.code <= 511) {
      ({ code } = err);
    }

    const message = err.message ? err.message : 'Internal Server Error';

    res.status(code).json({ error: message, success: false });

    const env = process.env.NODE_ENV || '';
    if (!['test', 'unit_test'].includes(env)) {
      throw err;
    }
  };

  app.use(errorHandler);

  return app;
}

export default createApp;
