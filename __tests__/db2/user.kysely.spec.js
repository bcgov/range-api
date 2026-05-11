import { db } from '../../src/libs/db2/kysely.js';
import User from '../../src/libs/db2/model/user.js';

describe('User model with Kysely', () => {
  const testUsername = `test_user_${Date.now()}`;
  let testUserId;

  beforeAll(async () => {
    const [{ id }] = await db
      .insertInto('user_account')
      .values({
        username: testUsername,
        email: 'test@example.com',
        given_name: 'Test',
        family_name: 'User',
        active: true,
      })
      .returning('id')
      .execute();
    testUserId = id;
  });

  afterAll(async () => {
    await db.deleteFrom('user_account').where('username', '=', testUsername).execute();
    await db.destroy();
  });

  test('find() returns users with camelCase properties', async () => {
    const users = await User.find(db, { username: testUsername });
    expect(Array.isArray(users)).toBe(true);
    expect(users.length).toBe(1);
    const user = users[0];
    expect(user).toBeInstanceOf(User);
    expect(user.username).toBe(testUsername);
    expect(user).toHaveProperty('givenName', 'Test');
    expect(user).toHaveProperty('familyName', 'User');
    expect(user).toHaveProperty('email', 'test@example.com');
    expect(user).toHaveProperty('active', true);
  });

  test('findById() returns a user by id', async () => {
    const user = await User.findById(db, testUserId);
    expect(user).toBeDefined();
    expect(user).toBeInstanceOf(User);
    expect(user.id).toBe(testUserId);
    expect(user.username).toBe(testUsername);
  });

  test('create() inserts and returns a new user', async () => {
    const newUsername = `test_create_${Date.now()}`;
    const newUser = await User.create(db, {
      username: newUsername,
      email: 'create@example.com',
      active: true,
    });

    expect(newUser).toBeDefined();
    expect(newUser).toBeInstanceOf(User);
    expect(newUser.username).toBe(newUsername);
    expect(newUser.email).toBe('create@example.com');

    // Cleanup
    await db.deleteFrom('user_account').where('username', '=', newUsername).execute();
  });

  test('update() modifies and returns updated user', async () => {
    const updatedUser = await User.update(
      db,
      { id: testUserId },
      { email: 'updated@example.com', givenName: 'Updated' },
    );

    expect(updatedUser).toBeDefined();
    expect(updatedUser.email).toBe('updated@example.com');
    expect(updatedUser.givenName).toBe('Updated');
  });

  test('remove() deletes matching row', async () => {
    const tempUsername = `test_remove_${Date.now()}`;
    const [{ id }] = await db
      .insertInto('user_account')
      .values({ username: tempUsername, email: 'remove@example.com', active: true })
      .returning('id')
      .execute();

    const count = await User.remove(db, { id });
    expect(Number(count)).toBeGreaterThan(0);

    const found = await User.findById(db, id);
    expect(found).toBeUndefined();
  });
});
