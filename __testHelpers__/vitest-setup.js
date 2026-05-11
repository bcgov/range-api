import dotenv from 'dotenv';
import { vi } from 'vitest';

dotenv.config();

globalThis.jest = vi;

// Polyfill SlowBuffer removed in Node.js 25 for buffer-equal-constant-time (transitive dep of jwa/jsonwebtoken)
import buffer from 'buffer';
if (typeof buffer.SlowBuffer === 'undefined') {
  buffer.SlowBuffer = buffer.Buffer;
}
