import { logger, started } from './libs/bcgov-shim.js';
import config from './config/index.js';
import createApp from './index.js';

const env = config.environment;
const port = config.port;

createApp()
  .then((app) => {
    app.listen(port as number, '0.0.0.0', () => {
      if (env !== 'production') {
        return started(port as number);
      }
      return logger.info(`Production server running on port: ${port}`);
    });
  })
  .catch((err: Error) => {
    logger.error('There was a problem creating the server.');
    logger.error(`Error: ${err.message}`);
  });
