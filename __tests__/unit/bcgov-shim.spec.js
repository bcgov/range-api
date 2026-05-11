import { describe, it, expect } from 'vitest';
import { logger, errorWithCode, started } from '../../src/libs/bcgov-shim.js';

describe('bcgov-shim', () => {
  describe('logger', () => {
    it('has info method', () => {
      expect(typeof logger.info).toBe('function');
    });

    it('has error method', () => {
      expect(typeof logger.error).toBe('function');
    });

    it('has debug method', () => {
      expect(typeof logger.debug).toBe('function');
    });

    it('has warn method', () => {
      expect(typeof logger.warn).toBe('function');
    });
  });

  describe('errorWithCode', () => {
    it('returns an Error', () => {
      const err = errorWithCode('test error', 400);
      expect(err).toBeInstanceOf(Error);
    });

    it('sets the message', () => {
      const err = errorWithCode('not found', 404);
      expect(err.message).toBe('not found');
    });

    it('sets the code property', () => {
      const err = errorWithCode('bad request', 400);
      expect(err.code).toBe(400);
    });

    it('defaults code to 500', () => {
      const err = errorWithCode('server error');
      expect(err.code).toBe(500);
    });
  });

  describe('started', () => {
    it('does not throw', () => {
      expect(() => started(8000)).not.toThrow();
    });
  });
});
