/**
 * Add over_use column to agreement table
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.alterTable('agreement', function (table) {
    table
      .decimal('over_use', 10, 2)
      .nullable()
      .comment('Amount of over use in AUMs (positive values indicate over use)');
  });
};

/**
 * Remove over_use column from agreement table
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.alterTable('agreement', function (table) {
    table.dropColumn('over_use');
  });
};
