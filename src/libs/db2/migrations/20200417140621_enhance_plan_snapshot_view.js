
exports.up = async (knex) => {
  await knex.raw(`
    create view plan_snapshot_summary as (
with all_snapshots as (
  select 
    id, 
    version, 
    snapshot, 
    cast(snapshot ->> 'statusId' as INTEGER) as snapshot_status_id, 
    plan_id, 
    created_at, 
    user_id 
  from 
    plan_snapshot
), 
plans_currently_in_progress_with_AH as (
  select 
    id, 
    false as withStaff, 
    true as withAH 
  from 
    plan 
  where 
    status_id in (1)
), 
plans_currently_in_progress_with_Staff as (
  select 
    id, 
    true as withStaff, 
    false as withAH 
  from 
    plan 
  where 
    status_id not in (1, 20, 8, 9, 12)
), 
plans_currently_approved as (
  select 
    id, 
    true as IsApproved, 
    false as IsInProgress 
  from 
    plan 
  where 
    status_id in (20, 8, 9, 12)
), 
plan_current_summary as (
  select 
    * 
  from 
    plans_currently_in_progress_with_AH 
  union all 
  select 
    * 
  from 
    plans_currently_in_progress_with_Staff
), 
current_snapshots as (
  select 
    id, 
    max(version), 
    cast(snapshot ->> 'statusId' as INTEGER) as snapshot_status_id, 
    plan_id 
  from 
    plan_snapshot 
  group by 
    id, 
    plan_id, 
    snapshot_status_id
), 
last_snapshot_with_different_status as (
  select 
    alls.id, 
    alls.plan_id, 
    alls.snapshot_status_id, 
    max(alls.version) as most_recent_version 
  from 
    all_snapshots alls 
    join current_snapshots cs on cs.plan_id = alls.plan_id 
  where 
    alls.snapshot_status_id != cs.snapshot_status_id 
  group by 
    alls.plan_id, 
    alls.version, 
    alls.snapshot_status_id, 
    alls.id 
  order by 
    alls.plan_id, 
    most_recent_version desc
), 
most_current_in_each_status as (
  select 
    id, 
    snapshot_status_id, 
    max(version), 
    plan_id 
  from 
    all_snapshots 
  group by 
    id, 
    snapshot_status_id, 
    plan_id, 
    version
), 
legal_snapshot_summary as (
  select 
    all_snapshots.id, 
    case when (
      all_snapshots.snapshot_status_id in (20, 8, 9, 12)
    ) then all_snapshots.created_at else null end as effective_legal_start, 
    case when exists (
      select 
        id 
      from 
        plan_snapshot 
      where 
        plan_id = all_snapshots.plan_id 
        and version = (all_snapshots.version + 1)
    ) then (
      select 
        created_at 
      from 
        plan_snapshot 
      where 
        plan_id = all_snapshots.plan_id 
        and version = (all_snapshots.version + 1)
    ) else null end as effective_legal_end 
  from 
    all_snapshots
) 
select 
  all_snapshots.id as snapshot_id, 
  all_snapshots.snapshot,
  all_snapshots.plan_id, 
  all_snapshots.created_at, 
  all_snapshots.version, 
  all_snapshots.snapshot_status_id as status_id,
  all_snapshots.user_id, 
  last_snapshot.snapshot_status_id as from_status_id, 
  all_snapshots.snapshot_status_id as to_status_id, 
  legal_snapshot_summary.effective_legal_start, 
  legal_snapshot_summary.effective_legal_end 
from 
  all_snapshots 
  join legal_snapshot_summary on legal_snapshot_summary.id = all_snapshots.id 
  join all_snapshots last_snapshot on all_snapshots.plan_id = last_snapshot.plan_id 
  and all_snapshots.version = (last_snapshot.version + 1) 
  join plan p on p.id = all_snapshots.plan_id

)`)
  
};

exports.down = async (knex) => {
    knex.raw('drop view plan_snapshot_summary;')
  
};
