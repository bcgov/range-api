declare module 'dotenv' {
  export function config(options?: Record<string, unknown>): { parsed?: Record<string, string> };
}

declare module '*/router/index.js' {
  import { Application } from 'express';
  function initRouter(app: Application): void;
  export default initRouter;
}
