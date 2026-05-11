import { db } from '../../src/libs/db2/kysely.js';

describe('Kysely database connection', () => {
  test('can execute a simple query', async () => {
    const result = await db.selectNoFrom((eb) => eb.val(1).as('val')).execute();
    expect(result).toBeDefined();
    expect(Number(result[0].val)).toBe(1);
  });

  afterAll(async () => {
    await db.destroy();
  });
});
