
exports.up = function(knex) {
  
    knex.raw('ALTER TABLE plan_snapshot ADD COLUMN IF NOT EXISTS user_id INTEGER;')

};

exports.down = function(knex) {
  
    knex.raw('ALTER TABLE plan_snapshot DROP COLUMN IF EXISTS user_id;')

};
