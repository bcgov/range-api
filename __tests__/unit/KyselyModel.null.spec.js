import { describe, expect, it, vi } from 'vitest';
import KyselyModel from '../../src/libs/db2/model/KyselyModel';

class TestModel extends KyselyModel {
  static get fields() {
    return ['id', 'client_id', 'requested_extension', 'email'];
  }

  static get table() {
    return 'plan_extension_requests';
  }
}

const makeDb = () => {
  const whereCalls = [];
  const db = {
    selectFrom: vi.fn(() => db),
    selectAll: vi.fn(() => db),
    select: vi.fn(() => db),
    updateTable: vi.fn(() => db),
    deleteFrom: vi.fn(() => db),
    set: vi.fn(() => db),
    returning: vi.fn(() => db),
    orderBy: vi.fn(() => db),
    where: vi.fn((...args) => {
      whereCalls.push(args);
      return db;
    }),
    execute: vi.fn().mockResolvedValue([]),
    fn: {
      countAll: vi.fn(() => ({ as: vi.fn(() => 'count') })),
    },
  };
  return { db, whereCalls };
};

describe('KyselyModel null predicates', () => {
  it('uses IS NULL when find receives a null scalar value', async () => {
    const { db, whereCalls } = makeDb();

    await TestModel.find(db, { client_id: '00003055', requested_extension: null });

    expect(whereCalls).toContainEqual(['client_id', '=', '00003055']);
    expect(whereCalls).toContainEqual(['requested_extension', 'is', null]);
    expect(whereCalls).not.toContainEqual(['requested_extension', '=', null]);
  });

  it('uses IS NULL when count receives a null scalar value', async () => {
    const { db, whereCalls } = makeDb();

    await TestModel.count(db, { requested_extension: null });

    expect(whereCalls).toContainEqual(['requested_extension', 'is', null]);
  });

  it('uses IS NULL in update predicates', async () => {
    const { db, whereCalls } = makeDb();

    await TestModel.update(db, { client_id: '00003055', requested_extension: null }, { email: 'new@test.ca' });

    expect(whereCalls).toContainEqual(['requested_extension', 'is', null]);
    expect(whereCalls).not.toContainEqual(['requested_extension', '=', null]);
  });

  it('uses IS NULL in remove predicates', async () => {
    const { db, whereCalls } = makeDb();

    await TestModel.remove(db, { client_id: '00003055', requested_extension: null });

    expect(whereCalls).toContainEqual(['requested_extension', 'is', null]);
    expect(whereCalls).not.toContainEqual(['requested_extension', '=', null]);
  });

  it('keeps empty-array find queries fail-closed', async () => {
    const { db } = makeDb();

    const results = await TestModel.find(db, { client_id: [] });

    expect(results).toEqual([]);
    expect(db.selectFrom).not.toHaveBeenCalled();
  });
});
