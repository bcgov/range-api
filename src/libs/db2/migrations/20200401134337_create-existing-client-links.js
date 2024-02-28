exports.up = async (knex) => {
  const { rows: userAccounts } = await knex.raw(`
    SELECT * FROM user_account WHERE client_id IS NOT NULL;
  `);

  await Promise.all(
    userAccounts.map(async (user) => {
      if (
        userAccounts.filter((u) => u.client_id === user.client_id).length > 1
      ) {
        console.warn(
          `There are multiple users linked to client ID ${user.client_id}. Skipping creation of link to user ID ${user.id}`,
        );
        return;
      }
      const result = await knex.raw(
        `
        INSERT INTO active_client_account(user_id, client_id, type, active)
        VALUES (?, ?, ?, ?);
      `,
        [user.id, user.client_id, 'owner', true],
      );

      if (result.rowCount === 0) {
        throw new Error(
          `Could not insert active client account for user: ${user}`,
        );
      }
    }),
  );

  await knex.raw(`
    ALTER TABLE user_account DROP COLUMN client_id;
  `);
};

exports.down = async (knex) => {
  await knex.raw(`
    ALTER TABLE user_account
      ADD COLUMN client_id INTEGER REFERENCES ref_client(id);
  `);

  const { rows: activeClientAccounts } = await knex.raw(`
    SELECT * FROM active_client_account;
  `);

  await Promise.all(
    activeClientAccounts.map(async (clientAccount) => {
      const result = await knex.raw(
        `
        UPDATE user_account SET client_id=? WHERE id=?
      `,
        [clientAccount.client_id, clientAccount.user_id],
      );

      if (result.rowCount === 0) {
        throw new Error(`Could not rollback client account: ${clientAccount}`);
      }
    }),
  );
};
