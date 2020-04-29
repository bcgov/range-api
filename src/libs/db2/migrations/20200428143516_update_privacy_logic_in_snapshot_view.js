
exports.up = async (knex) => {
  await knex.raw(`
    alter view if exists plan_snapshot_summary as (
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
current_snapshots as (
  select 
    id, 
    max(version) as version, 
    (max(version) - 1) as previous_version,
    plan_id 
  from 
    plan_snapshot 
  group by 
    id, 
    plan_id 
), 
most_recent_version_of_each_status as (
select id,snapshot_status_id, plan_id, max(version)
from all_snapshots
group by id, plan_id, version,snapshot_status_id
order by plan_id asc, version desc
),
current_WIP_rups as (
select als.id, als.plan_id, als.snapshot_status_id
from all_snapshots als
inner join current_snapshots on current_snapshots.id = als.id 
where snapshot_status_id not in (20, 8, 9, 12)
),
privacy_snapshots as (
select id, max(version), true as isPrivacyVersion
from all_snapshots als
where plan_id in (select plan_id from current_WIP_rups where current_WIP_rups.plan_id = als.plan_id limit 1)
and als.snapshot_status_id != (select current_WIP_rups.snapshot_status_id from current_WIP_rups where current_WIP_rups.plan_id = als.plan_id order by version desc limit 1)
group by id, version
)
,
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
    ) and all_snapshots.snapshot_status_id in (20, 8, 9, 12)
    then (
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
  all_snapshots.id, 
  all_snapshots.snapshot,
  all_snapshots.plan_id, 
  all_snapshots.created_at, 
  all_snapshots.version, 
  all_snapshots.snapshot_status_id as status_id,
  all_snapshots.user_id, 
  last_snapshot.snapshot_status_id as from_status_id, 
  all_snapshots.snapshot_status_id as to_status_id, 
  legal_snapshot_summary.effective_legal_start, 
  legal_snapshot_summary.effective_legal_end,
  coalesce(privacy_snapshots.isPrivacyVersion, false) as isPrivacyVersion
from 
  all_snapshots 
  left join legal_snapshot_summary on legal_snapshot_summary.id = all_snapshots.id 
  left join privacy_snapshots on privacy_snapshots.id = all_snapshots.id
  left join all_snapshots last_snapshot on all_snapshots.plan_id = last_snapshot.plan_id 
  and all_snapshots.version = (last_snapshot.version + 1) 
  join plan p on p.id = all_snapshots.plan_id

)`)
  
};

exports.down = async (knex) => {
await knex.raw(`
    alter view if exists plan_snapshot_summary as (
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
current_snapshots as (
  select 
    id, 
    max(version) as version, 
    (max(version) - 1) as previous_version,
    plan_id 
  from 
    plan_snapshot 
  group by 
    id, 
    plan_id 
), 
current_WIP_rups as (
select als.id, als.plan_id, als.snapshot_status_id
from all_snapshots als
inner join current_snapshots on current_snapshots.id = als.id 
where snapshot_status_id not in (20, 8, 9, 12)
),
privacy_snapshots as (
select id, max(version), true as isPrivacyVersion
from all_snapshots als
where plan_id in (select plan_id from current_WIP_rups where current_WIP_rups.plan_id = als.plan_id limit 1)
and als.snapshot_status_id != (select current_WIP_rups.snapshot_status_id from current_WIP_rups where current_WIP_rups.plan_id = als.plan_id order by version desc limit 1)
group by id, version
)
,
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
    ) and all_snapshots.snapshot_status_id in (20, 8, 9, 12)
    then (
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
  all_snapshots.id, 
  all_snapshots.snapshot,
  all_snapshots.plan_id, 
  all_snapshots.created_at, 
  all_snapshots.version, 
  all_snapshots.snapshot_status_id as status_id,
  all_snapshots.user_id, 
  last_snapshot.snapshot_status_id as from_status_id, 
  all_snapshots.snapshot_status_id as to_status_id, 
  legal_snapshot_summary.effective_legal_start, 
  legal_snapshot_summary.effective_legal_end,
  coalesce(privacy_snapshots.isPrivacyVersion, false) as isPrivacyVersion
from 
  all_snapshots 
  left join legal_snapshot_summary on legal_snapshot_summary.id = all_snapshots.id 
  left join privacy_snapshots on privacy_snapshots.id = all_snapshots.id
  left join all_snapshots last_snapshot on all_snapshots.plan_id = last_snapshot.plan_id 
  and all_snapshots.version = (last_snapshot.version + 1) 
  join plan p on p.id = all_snapshots.plan_id

)`
  
};
