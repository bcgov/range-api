exports.up = async (knex) => {
  await knex.raw(`
  ALTER TABLE agreement 
    ADD COLUMN retired BOOLEAN DEFAULT FALSE;
  `);
  await knex.raw(`
  UPDATE agreement 
    SET retired = TRUE 
    WHERE forest_file_id='RAN077434'
    OR forest_file_id='RAN077506'
    OR forest_file_id='RAN077503'
    OR forest_file_id='RAN077522'
    OR forest_file_id='RAN077535'
    OR forest_file_id='RAN077783'
    OR forest_file_id='RAN078117';
  `);
};

exports.down = async (knex) => {
  await knex.raw('ALTER TABLE user_account DROP COLUMN retired');
};
