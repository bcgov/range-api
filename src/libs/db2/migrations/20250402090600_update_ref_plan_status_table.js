exports.up = async (knex) => {
  await knex('ref_plan_status').where('id', 1).update({ name: 'Add Content to RUP - AH' });
  await knex('ref_plan_status').where('id', 2).update({ name: 'Completed' });
  await knex('ref_plan_status').where('id', 3).update({ name: 'Pending' });
  await knex('ref_plan_status').where('id', 4).update({ name: 'Draft in Progress - AH' });
  await knex('ref_plan_status').where('id', 5).update({ name: 'Awaiting Input - AH' });
  await knex('ref_plan_status').where('id', 6).update({ name: 'Staff Draft' });
  await knex('ref_plan_status').where('id', 7).update({ name: 'Wrongly Made Without Effect - AH' });
  await knex('ref_plan_status').where('id', 8).update({ name: 'Wrongly Made Stands' });
  await knex('ref_plan_status').where('id', 9).update({ name: 'Stands' });
  await knex('ref_plan_status').where('id', 10).update({ name: 'Changes Requested - AH' });
  await knex('ref_plan_status').where('id', 11).update({ name: 'Not Approved' });
  await knex('ref_plan_status').where('id', 12).update({ name: 'Approved' });
  await knex('ref_plan_status').where('id', 13).update({ name: 'Awaiting Feedback - SA' });
  await knex('ref_plan_status').where('id', 14).update({ name: 'Awaiting Decision - SA' });
  await knex('ref_plan_status').where('id', 15).update({ name: 'Approval Recommended - DM' });
  await knex('ref_plan_status').where('id', 16).update({ name: 'Approval Not Recommended - DM' });
  await knex('ref_plan_status').where('id', 17).update({ name: 'Ready For Final Decision' });
  await knex('ref_plan_status').where('id', 18).update({ name: 'Signatures Pending - AH' });
  await knex('ref_plan_status').where('id', 19).update({ name: 'Recommended For Submission - AH' });
  await knex('ref_plan_status').where('id', 20).update({ name: 'Stands - Needs Decision - DM' });
  await knex('reo_plan_status').where('id', 21).update({ name: 'Stands - Not Reviewed - AH' });
  await knex('ref_plan_status').where('id', 22).update({ name: 'Mandatory Amendment Created - SA' });
  await knex('ref_plan_status').where('id', 23).update({ name: 'Amendment Created - AH' });
  await knex('ref_plan_status').where('id', 25).update({ name: 'Retired' });
  await knex('ref_plan_status').where('id', 26).update({ name: 'Expired' });
};

exports.down = async () => {};
