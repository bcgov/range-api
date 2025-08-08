/**
 * NoUse implementation - Add usage tracking columns to agreement table
 * This migration adds:
 * - usage_status: integer column to track usage status (0: NoUse, 1: OverUse, null: Normal)
 * - percentage_use: decimal column to store percentage usage values
 * - hasCurrentSchedule: integer column to indicate if agreement has current schedule
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.alterTable('agreement', function (table) {
    // Add usage status tracking
    table.integer('usage_status').nullable().defaultTo(null).comment('0: NoUse, 1: OverUse, null: Normal');

    // Add percentage use tracking
    table
      .decimal('percentage_use', 10, 2)
      .nullable()
      .defaultTo(null)
      .comment('Percentage usage value with 2 decimal places');

    // Add current schedule indicator
    table
      .integer('has_current_schedule')
      .nullable()
      .defaultTo(null)
      .comment('Indicates if agreement has current schedule (numeric)');
  });
};

/**
 * Remove NoUse implementation columns from agreement table
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.alterTable('agreement', function (table) {
    table.dropColumn('usage_status');
    table.dropColumn('percentage_use');
    table.dropColumn('has_current_schedule');
  });
};
