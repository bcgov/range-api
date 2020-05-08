
exports.up = async (knex) => {
  await knex.raw(`
drop view if exists plan_snapshot_summary;
create view plan_snapshot_summary as (
WITH all_snapshots AS (
  SELECT 
    id, 
    version, 
    snapshot, 
    Cast(snapshot ->> 'statusId' AS INTEGER) AS snapshot_status_id, 
    plan_id, 
    created_at, 
    user_id, 
    is_discarded 
  FROM 
    plan_snapshot
), 
max_version_of_plan AS (
  SELECT 
    Max(version) AS version, 
    plan_id 
  FROM 
    all_snapshots 
  GROUP BY 
    plan_id
), 
max_version_of_plan_in_each_status AS (
  SELECT 
    Max(version) AS version, 
    plan_id, 
    snapshot_status_id 
  FROM 
    all_snapshots 
  GROUP BY 
    plan_id, 
    snapshot_status_id
), 
most_recent_snapshot_of_each_status AS (
  SELECT 
    als.id, 
    als.snapshot_status_id, 
    als.plan_id, 
    als.version 
  FROM 
    max_version_of_plan_in_each_status mr 
    INNER JOIN all_snapshots als ON mr.plan_id = als.plan_id 
    AND mr.version = als.version 
  ORDER BY 
    plan_id ASC, 
    version DESC
), 
privacy_versions AS (
  SELECT 
    als.id, 
    CASE 
	--when in AH draft
	WHEN 	EXISTS ( SELECT id 	FROM 	PLAN p 
					WHERE 	als.plan_id = id 
					AND 	status_id = 1 
					and 	Cast(asl.snapshot ->> 'amendmentTypeId' AS INTEGER) is null) 
	    	AND als.snapshot_status_id = 6 
	    	AND EXISTS ( SELECT id FROM most_recent_snapshot_of_each_status WHERE id = als.id) 
	THEN 'StaffView' 

	-- agreement holder submits back
	WHEN 	EXISTS ( SELECT id FROM PLAN p WHERE als.plan_id = id AND status_id = 13) 
    		AND als.snapshot_status_id = 1 
    		AND EXISTS ( SELECT id FROM most_recent_snapshot_of_each_status WHERE id = als.id) 
	THEN 'AHView' 

	WHEN 	EXISTS ( SELECT id FROM PLAN p WHERE als.plan_id = id AND status_id = 5) 
    		AND als.snapshot_status_id = 13 
    		AND EXISTS ( SELECT id FROM most_recent_snapshot_of_each_status WHERE id = als.id) 
	THEN 'StaffView' 
	
	WHEN 	EXISTS ( SELECT id FROM PLAN p WHERE als.plan_id = id AND status_id = 19) 
    		AND als.snapshot_status_id = 13 
    		AND EXISTS ( SELECT id FROM most_recent_snapshot_of_each_status WHERE id = als.id) 
	THEN 'StaffView' 

	WHEN 	EXISTS ( SELECT id FROM PLAN p WHERE als.plan_id = id AND status_id = 18) 
    		AND als.snapshot_status_id = 13 
    		AND EXISTS ( SELECT id FROM most_recent_snapshot_of_each_status WHERE id = als.id) 
	THEN 'StaffView' 

	--staff mandatory initiated
	WHEN 	EXISTS ( SELECT id FROM PLAN p WHERE als.plan_id = id AND status_id = 22) 
    		AND EXISTS ( SELECT id 	FROM 	legal_snapshot_summary 
					WHERE 	id = als.id 
						and effective_legal_start is not null 
						and effective_legal_end is null) 
	THEN 'AHView' 

	--staff mandatory kicked to AH court
	WHEN 	EXISTS ( SELECT id 	FROM 	PLAN p 
					WHERE 	als.plan_id = id 
					AND 	status_id = 1 
					and 	Cast(asl.snapshot ->> 'amendmentTypeId' AS INTEGER) = 2) 
    		AND EXISTS ( SELECT id 	FROM 	legal_snapshot_summary 
					WHERE 	id = als.id 
						and effective_legal_start is not null 
						and effective_legal_end is null) 
	THEN 'StaffView' 
	ELSE NULL
    END AS privacyView 
  FROM 
    all_snapshots als
), 
snapshots_with_legal_statuses AS (
  SELECT 
    all_snapshots.id, 
    all_snapshots.plan_id, 
    all_snapshots.created_at, 
    Row_number() OVER (
      ORDER BY 
        plan_id, 
        version ASC
    ) AS legal_version 
  FROM 
    all_snapshots 
  WHERE 
    all_snapshots.snapshot_status_id IN (20, 8, 9, 12, 21) 
    AND all_snapshots.is_discarded = false
), 
legal_snapshot_summary AS (
  SELECT 
    swl.id, 
    swl.created_at AS effective_legal_start, 
    CASE WHEN EXISTS (
      SELECT 
        id 
      FROM 
        snapshots_with_legal_statuses 
      WHERE 
        plan_id = swl.plan_id 
        AND legal_version = (swl.legal_version + 1)
    ) THEN (
      SELECT 
        created_at 
      FROM 
        snapshots_with_legal_statuses 
      WHERE 
        plan_id = swl.plan_id 
        AND legal_version = (swl.legal_version + 1)
    ) ELSE NULL END AS effective_legal_end 
  FROM 
    snapshots_with_legal_statuses swl
) 
SELECT 
  all_snapshots.id, 
  all_snapshots.snapshot, 
  all_snapshots.plan_id, 
  all_snapshots.created_at, 
  all_snapshots.version, 
  all_snapshots.snapshot_status_id AS status_id, 
  all_snapshots.user_id, 
  last_snapshot.snapshot_status_id AS from_status_id, 
  all_snapshots.snapshot_status_id AS to_status_id, 
  legal_snapshot_summary.effective_legal_start, 
  legal_snapshot_summary.effective_legal_end, 
  privacy_versions.privacyview 
FROM 
  all_snapshots 
  LEFT JOIN legal_snapshot_summary ON legal_snapshot_summary.id = all_snapshots.id 
  LEFT JOIN all_snapshots last_snapshot ON all_snapshots.plan_id = last_snapshot.plan_id 
  AND all_snapshots.version = (last_snapshot.version + 1) 
  LEFT JOIN privacy_versions ON privacy_versions.id = all_snapshots.id 
  JOIN PLAN p ON p.id = all_snapshots.plan_id
);`)
  
};

exports.down = async (knex) => {
  await knex.raw(`
  drop view if exists plan_snapshot_summary; 
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
max_version_of_plan as (
    select max(version) as version,
    plan_id
    from all_snapshots
    group by plan_id
),
max_version_of_plan_in_each_status as (
    select max(version) as  version,
    plan_id,
    snapshot_status_id
    from  all_snapshots
    group by plan_id, snapshot_status_id
),
most_recent_snapshot_of_each_status as (
select als.id,als.snapshot_status_id,als.plan_id,als.version
from max_version_of_plan_in_each_status mr
inner join all_snapshots als on mr.plan_id = als.plan_id and mr.version = als.version
order by plan_id asc, version desc
),
privacy_versions as (
    select als.id,
        case when exists (select id from plan p where als.plan_id = id and status_id = 1) 
             and als.snapshot_status_id = 6
             and exists (select id from most_recent_snapshot_of_each_status where id  =  als.id) 
                 then 'StaffView' 
        when exists (select id from plan p where als.plan_id = id and status_id = 13) 
             and als.snapshot_status_id = 1
             and exists (select id from most_recent_snapshot_of_each_status where id  =  als.id) 
                then 'AHView' 
        when exists (select id from plan p where als.plan_id = id and status_id = 5) 
             and als.snapshot_status_id = 13
             and exists (select id from most_recent_snapshot_of_each_status where id  =  als.id) 
                then 'StaffView' 
        when exists (select id from plan p where als.plan_id = id and status_id = 19) 
             and als.snapshot_status_id = 13
             and exists (select id from most_recent_snapshot_of_each_status where id  =  als.id) 
                then 'StaffView' 
        when exists (select id from plan p where als.plan_id = id and status_id = 18) 
             and als.snapshot_status_id = 13
             and exists (select id from most_recent_snapshot_of_each_status where id  =  als.id) 
                then 'StaffView' 
        else null
        end as privacyView
    from  all_snapshots als
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
  privacy_versions.privacyView
from 
  all_snapshots 
  left join legal_snapshot_summary on legal_snapshot_summary.id = all_snapshots.id 
  left join all_snapshots last_snapshot on all_snapshots.plan_id = last_snapshot.plan_id 
  and all_snapshots.version = (last_snapshot.version + 1) 
  left join privacy_versions on privacy_versions.id = all_snapshots.id
  join plan p on p.id = all_snapshots.plan_id

);`)
  
};
