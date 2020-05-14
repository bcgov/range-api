
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
snapshots_with_legal_statuses AS (
  SELECT 
    all_snapshots.id, 
    all_snapshots.plan_id, 
    all_snapshots.snapshot,
    all_snapshots.created_at, 
    all_snapshots.version,
    all_snapshots.snapshot_status_id,
    Row_number() OVER (
      ORDER BY 
        plan_id, 
        version ASC
    ) AS legal_version 
  FROM 
    all_snapshots 
  WHERE 
    all_snapshots.snapshot_status_id IN (21, 12) 
    AND all_snapshots.is_discarded = false
), 
legal_snapshot_summary AS (
  SELECT 
    swl.id, 
    swl.created_at AS effective_legal_start, 
    swl.snapshot_status_id,
    CASE WHEN EXISTS (
      SELECT 
        id 
      FROM 
        snapshots_with_legal_statuses 
      WHERE 
        plan_id = swl.plan_id 
        AND legal_version = (swl.legal_version + 1)
    ) THEN (
	false
    ) ELSE true END AS is_current_legal_version,
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
    ) ELSE (swl.snapshot ->> 'planEndDate')::timestamp with time zone END AS effective_legal_end 
  FROM 
    snapshots_with_legal_statuses swl
), 
legal_version_reason as (
	with associated_legal_versions as (
	  select 
	    als.id, 
	    als.plan_id, 
	    als.snapshot_status_id,
	    als.snapshot,
	    als.version, 
	    swl.id as associated_legal_id 
	  from 
	    all_snapshots als 
	    left join snapshots_with_legal_statuses swl on als.version <= swl.version 
	    and als.plan_id = swl.plan_id 
	    and (
	      als.version > coalesce(
		(
		  select 
		    swl2.version 
		  from 
		    snapshots_with_legal_statuses swl2 
		  where 
		    swl2.plan_id = swl.plan_id 
		    and swl2.legal_version = (swl.legal_version - 1) 
		    or swl2.legal_version = null
		), 
		0
	      )
	    )
	),
        AH_mandatories as (
		select associated_legal_id, 'AH Mandatory' as legal_reason
		from associated_legal_versions
		where snapshot_status_id = 23 
		and 	Cast(snapshot ->> 'amendmentTypeId' AS INTEGER) = 2 
		group by associated_legal_id, legal_reason
	),
        Staff_mandatories as (
		select associated_legal_id, 'Staff Mandatory' as legal_reason
		from associated_legal_versions
		where snapshot_status_id = 22 
		group by associated_legal_id, legal_reason
	),
        AH_minors as (
		select associated_legal_id, 'AH Minor' as legal_reason
		from associated_legal_versions
		where snapshot_status_id = 21 
		group by associated_legal_id, legal_reason
	),
        inital_RUPS as (
		select associated_legal_id, 'Initial RUP' as legal_reason
		from associated_legal_versions
		where snapshot_status_id = 12 
		and 	Cast(snapshot ->> 'amendmentTypeId' AS INTEGER) is null
		group by associated_legal_id, legal_reason
	),
	legal_reason_summary as (

		select associated_legal_id ,  legal_reason
		from AH_mandatories
		union all
		select associated_legal_id ,  legal_reason
		from Staff_mandatories
		union all
		select associated_legal_id ,  legal_reason
		from AH_minors
		union all
		select associated_legal_id ,  legal_reason
		from inital_RUPS
	)
	select av.id, av.associated_legal_id, lr.legal_reason
	from associated_legal_versions av
	left join legal_reason_summary lr on lr.associated_legal_id = av.associated_legal_id
),
privacy_versions AS (
  SELECT 
    als.id, 
    CASE 
	--when in AH draft
	WHEN 	EXISTS ( SELECT id 	FROM 	PLAN p 
					WHERE 	als.plan_id = id 
					AND 	status_id = 1 
					and 	Cast(als.snapshot ->> 'amendmentTypeId' AS INTEGER) is null) 
	    	AND als.snapshot_status_id = 6 
	    	AND EXISTS ( SELECT id FROM most_recent_snapshot_of_each_status WHERE id = als.id) 
		AND (
			als.version > (	select 	version 
					from 	legal_snapshot_summary 
					where 	plan_id = als.plan_id 
						and is_current_legal_version = true 
					order by version desc
					limit 1 
				   ) 
		      OR
			not exists (	select 	id 
					from 	legal_snapshot_summary 
					where 	plan_id = als.plan_id and is_current_legal_version is not null
				   )
		    )
	THEN 'StaffView' 

	-- agreement holder submits back
	WHEN 	EXISTS ( SELECT id FROM PLAN p WHERE als.plan_id = id AND status_id = 13) 
    		AND als.snapshot_status_id = 1 
    		AND EXISTS ( SELECT id FROM most_recent_snapshot_of_each_status WHERE id = als.id) 
		AND (
			als.version > (	select 	version 
					from 	legal_snapshot_summary 
					where 	plan_id = als.plan_id 
						and is_current_legal_version = true 
					order by version desc
					limit 1 
				   ) 
		      OR
			not exists (	select 	id 
					from 	legal_snapshot_summary 
					where 	plan_id = als.plan_id and is_current_legal_version is not null
				   )
		    )
	THEN 'AHView' 

	WHEN 	EXISTS ( SELECT id FROM PLAN p WHERE als.plan_id = id AND status_id = 5) 
    		AND als.snapshot_status_id = 13 
    		AND EXISTS ( SELECT id FROM most_recent_snapshot_of_each_status WHERE id = als.id) 
		AND (
			als.version > (	select 	version 
					from 	legal_snapshot_summary 
					where 	plan_id = als.plan_id 
						and is_current_legal_version = true 
					order by version desc
					limit 1 
				   ) 
		      OR
			not exists (	select 	id 
					from 	legal_snapshot_summary 
					where 	plan_id = als.plan_id and is_current_legal_version is not null
				   )
		    )
	THEN 'StaffView' 
	
	WHEN 	EXISTS ( SELECT id FROM PLAN p WHERE als.plan_id = id AND status_id = 19) 
    		AND als.snapshot_status_id = 13 
    		AND EXISTS ( SELECT id FROM most_recent_snapshot_of_each_status WHERE id = als.id) 
		AND (
			als.version > (	select 	version 
					from 	legal_snapshot_summary 
					where 	plan_id = als.plan_id 
						and is_current_legal_version = true 
					order by version desc
					limit 1 
				   ) 
		      OR
			not exists (	select 	id 
					from 	legal_snapshot_summary 
					where 	plan_id = als.plan_id and is_current_legal_version is not null
				   )
		    )
	THEN 'StaffView' 

	WHEN 	EXISTS ( SELECT id FROM PLAN p WHERE als.plan_id = id AND status_id = 18) 
    		AND als.snapshot_status_id = 13 
    		AND EXISTS ( SELECT id FROM most_recent_snapshot_of_each_status WHERE id = als.id) 
		AND (
			als.version > (	select 	version 
					from 	legal_snapshot_summary 
					where 	plan_id = als.plan_id 
						and is_current_legal_version = true 
					order by version desc
					limit 1 
				   ) 
		      OR
			not exists (	select 	id 
					from 	legal_snapshot_summary 
					where 	plan_id = als.plan_id and is_current_legal_version is not null
				   )
		    )
	THEN 'StaffView' 

	--staff mandatory initiated
	WHEN 	EXISTS ( SELECT id FROM PLAN p WHERE als.plan_id = id AND status_id = 22) 
    		AND EXISTS ( SELECT id 	FROM 	legal_snapshot_summary 
					WHERE 	id = als.id 
						and effective_legal_start is not null 
						and effective_legal_end is null) 
		AND (
			als.version > (	select 	version 
					from 	legal_snapshot_summary 
					where 	plan_id = als.plan_id 
						and is_current_legal_version = true 
					order by version desc
					limit 1 
				   ) 
		      OR
			not exists (	select 	id 
					from 	legal_snapshot_summary 
					where 	plan_id = als.plan_id and is_current_legal_version is not null
				   )
		    )
	THEN 'AHView' 

	--staff mandatory kicked to AH court
	WHEN 	EXISTS ( SELECT id 	FROM 	PLAN p 
					WHERE 	als.plan_id = id 
					AND 	status_id = 1 
					and 	Cast(als.snapshot ->> 'amendmentTypeId' AS INTEGER) = 2) 
    		AND als.snapshot_status_id = 22 
    		AND EXISTS ( SELECT id FROM most_recent_snapshot_of_each_status WHERE id = als.id) 
		AND (
			als.version > (	select 	version 
					from 	legal_snapshot_summary 
					where 	plan_id = als.plan_id 
						and is_current_legal_version = true 
					order by version desc
					limit 1 
				   ) 
		      OR
			not exists (	select 	id 
					from 	legal_snapshot_summary 
					where 	plan_id = als.plan_id and is_current_legal_version is not null
				   )
		    )
	THEN 'StaffView' 

	--staff mandatory getting signed
	WHEN 	EXISTS ( SELECT id 	FROM 	PLAN p 
					WHERE 	als.plan_id = id 
					AND 	status_id = 18 
					and 	Cast(als.snapshot ->> 'amendmentTypeId' AS INTEGER) = 2) 
    		AND als.snapshot_status_id = 22 
    		AND EXISTS ( SELECT id FROM most_recent_snapshot_of_each_status WHERE id = als.id) 
		AND (
			als.version > (	select 	version 
					from 	legal_snapshot_summary 
					where 	plan_id = als.plan_id 
						and is_current_legal_version = true 
					order by version desc
					limit 1 
				   ) 
		      OR
			not exists (	select 	id 
					from 	legal_snapshot_summary 
					where 	plan_id = als.plan_id and is_current_legal_version is not null
				   )
		    )
	THEN 'StaffView' 

	--ah minor initiated
	WHEN 	EXISTS ( SELECT id FROM PLAN p 
			           WHERE als.plan_id = id 
				   AND status_id = 23)
    		AND EXISTS ( SELECT id 	FROM 	legal_snapshot_summary 
					WHERE 	id = als.id 
						and effective_legal_start is not null 
						and effective_legal_end is null) 
		AND (
			als.version > (	select 	version 
					from 	legal_snapshot_summary 
					where 	plan_id = als.plan_id 
						and is_current_legal_version = true 
					order by version desc
					limit 1 
				   ) 
		      OR
			not exists (	select 	id 
					from 	legal_snapshot_summary 
					where 	plan_id = als.plan_id and is_current_legal_version is not null
				   )
		    )
	THEN 'StaffView' 

	--ah minor awaiting signatures
	WHEN 	EXISTS ( SELECT id FROM PLAN p 
			           WHERE als.plan_id = id 
				   AND status_id = 18 
					and 	Cast(als.snapshot ->> 'amendmentTypeId' AS INTEGER) = 1) 
    		AND EXISTS ( SELECT id 	FROM 	legal_snapshot_summary 
					WHERE 	id = als.id 
						and effective_legal_start is not null 
						and effective_legal_end is null) 
		AND (
			als.version > (	select 	version 
					from 	legal_snapshot_summary 
					where 	plan_id = als.plan_id 
						and is_current_legal_version = true 
					order by version desc
					limit 1 
				   ) 
		      OR
			not exists (	select 	id 
					from 	legal_snapshot_summary 
					where 	plan_id = als.plan_id and is_current_legal_version is not null
				   )
		    )
	THEN 'StaffView' 
	ELSE NULL
    END AS privacyView 
  FROM 
    all_snapshots als
)
SELECT 
  all_snapshots.id, 
  all_snapshots.plan_id, 
  all_snapshots.created_at, 
  all_snapshots.snapshot,
  all_snapshots.version, 
  all_snapshots.snapshot_status_id AS status_id, 
  all_snapshots.user_id, 
  legal_version_reason.legal_reason,
  legal_version_reason.associated_legal_id,
  legal_snapshot_summary.is_current_legal_version, 
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
  LEFT JOIN legal_version_reason on  legal_version_reason.id = all_snapshots.id 
  LEFT JOIN privacy_versions ON privacy_versions.id = all_snapshots.id 
  JOIN PLAN p ON p.id = all_snapshots.plan_id
order by all_snapshots.version desc
);`)
  
};


exports.down = async (knex) => {
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
snapshots_with_legal_statuses AS (
  SELECT 
    all_snapshots.id, 
    all_snapshots.plan_id, 
    all_snapshots.created_at, 
    all_snapshots.version,
    all_snapshots.snapshot_status_id,
    Row_number() OVER (
      ORDER BY 
        plan_id, 
        version ASC
    ) AS legal_version 
  FROM 
    all_snapshots 
  WHERE 
    all_snapshots.snapshot_status_id IN (21, 12) 
    AND all_snapshots.is_discarded = false
), 
legal_snapshot_summary AS (
  SELECT 
    swl.id, 
    swl.created_at AS effective_legal_start, 
    swl.snapshot_status_id,
    CASE WHEN EXISTS (
      SELECT 
        id 
      FROM 
        snapshots_with_legal_statuses 
      WHERE 
        plan_id = swl.plan_id 
        AND legal_version = (swl.legal_version + 1)
    ) THEN (
	false
    ) ELSE true END AS isCurrentLegalVersion,
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
    ) ELSE (select plan_end_date from plan where plan_id = swl.plan_id order by version desc limit 1) END AS effective_legal_end 
  FROM 
    snapshots_with_legal_statuses swl
), 
legal_version_reason as (
	with associated_legal_versions as (
	  select 
	    als.id, 
	    als.plan_id, 
	    als.snapshot_status_id,
	    als.snapshot,
	    als.version, 
	    swl.id as associated_legal_id 
	  from 
	    all_snapshots als 
	    left join snapshots_with_legal_statuses swl on als.version <= swl.version 
	    and als.plan_id = swl.plan_id 
	    and (
	      als.version > coalesce(
		(
		  select 
		    swl2.version 
		  from 
		    snapshots_with_legal_statuses swl2 
		  where 
		    swl2.plan_id = swl.plan_id 
		    and swl2.legal_version = (swl.legal_version - 1) 
		    or swl2.legal_version = null
		), 
		0
	      )
	    )
	),
        AH_mandatories as (
		select associated_legal_id, 'AH Mandatory' as legal_reason
		from associated_legal_versions
		where snapshot_status_id = 23 
		and 	Cast(snapshot ->> 'amendmentTypeId' AS INTEGER) = 2 
		group by associated_legal_id, legal_reason
	),
        Staff_mandatories as (
		select associated_legal_id, 'Staff Mandatory' as legal_reason
		from associated_legal_versions
		where snapshot_status_id = 22 
		group by associated_legal_id, legal_reason
	),
        AH_minors as (
		select associated_legal_id, 'AH Minor' as legal_reason
		from associated_legal_versions
		where snapshot_status_id = 21 
		group by associated_legal_id, legal_reason
	),
        inital_RUPS as (
		select associated_legal_id, 'Initial RUP' as legal_reason
		from associated_legal_versions
		where snapshot_status_id = 12 
		and 	Cast(snapshot ->> 'amendmentTypeId' AS INTEGER) is null
		group by associated_legal_id, legal_reason
	),
	legal_reason_summary as (

		select associated_legal_id ,  legal_reason
		from AH_mandatories
		union all
		select associated_legal_id ,  legal_reason
		from Staff_mandatories
		union all
		select associated_legal_id ,  legal_reason
		from AH_minors
		union all
		select associated_legal_id ,  legal_reason
		from inital_RUPS
	)
	select av.id, av.associated_legal_id, lr.legal_reason
	from associated_legal_versions av
	left join legal_reason_summary lr on lr.associated_legal_id = av.associated_legal_id
),
privacy_versions AS (
  SELECT 
    als.id, 
    CASE 
	--when in AH draft
	WHEN 	EXISTS ( SELECT id 	FROM 	PLAN p 
					WHERE 	als.plan_id = id 
					AND 	status_id = 1 
					and 	Cast(als.snapshot ->> 'amendmentTypeId' AS INTEGER) is null) 
	    	AND als.snapshot_status_id = 6 
	    	AND EXISTS ( SELECT id FROM most_recent_snapshot_of_each_status WHERE id = als.id) 
		AND (
			als.version > (	select 	version 
					from 	legal_snapshot_summary 
					where 	plan_id = als.plan_id 
						and isCurrentLegalVersion = true 
					order by version desc
					limit 1 
				   ) 
		      OR
			not exists (	select 	id 
					from 	legal_snapshot_summary 
					where 	plan_id = als.plan_id and isCurrentLegalVersion is not null
				   )
		    )
	THEN 'StaffView' 

	-- agreement holder submits back
	WHEN 	EXISTS ( SELECT id FROM PLAN p WHERE als.plan_id = id AND status_id = 13) 
    		AND als.snapshot_status_id = 1 
    		AND EXISTS ( SELECT id FROM most_recent_snapshot_of_each_status WHERE id = als.id) 
		AND (
			als.version > (	select 	version 
					from 	legal_snapshot_summary 
					where 	plan_id = als.plan_id 
						and isCurrentLegalVersion = true 
					order by version desc
					limit 1 
				   ) 
		      OR
			not exists (	select 	id 
					from 	legal_snapshot_summary 
					where 	plan_id = als.plan_id and isCurrentLegalVersion is not null
				   )
		    )
	THEN 'AHView' 

	WHEN 	EXISTS ( SELECT id FROM PLAN p WHERE als.plan_id = id AND status_id = 5) 
    		AND als.snapshot_status_id = 13 
    		AND EXISTS ( SELECT id FROM most_recent_snapshot_of_each_status WHERE id = als.id) 
		AND (
			als.version > (	select 	version 
					from 	legal_snapshot_summary 
					where 	plan_id = als.plan_id 
						and isCurrentLegalVersion = true 
					order by version desc
					limit 1 
				   ) 
		      OR
			not exists (	select 	id 
					from 	legal_snapshot_summary 
					where 	plan_id = als.plan_id and isCurrentLegalVersion is not null
				   )
		    )
	THEN 'StaffView' 
	
	WHEN 	EXISTS ( SELECT id FROM PLAN p WHERE als.plan_id = id AND status_id = 19) 
    		AND als.snapshot_status_id = 13 
    		AND EXISTS ( SELECT id FROM most_recent_snapshot_of_each_status WHERE id = als.id) 
		AND (
			als.version > (	select 	version 
					from 	legal_snapshot_summary 
					where 	plan_id = als.plan_id 
						and isCurrentLegalVersion = true 
					order by version desc
					limit 1 
				   ) 
		      OR
			not exists (	select 	id 
					from 	legal_snapshot_summary 
					where 	plan_id = als.plan_id and isCurrentLegalVersion is not null
				   )
		    )
	THEN 'StaffView' 

	WHEN 	EXISTS ( SELECT id FROM PLAN p WHERE als.plan_id = id AND status_id = 18) 
    		AND als.snapshot_status_id = 13 
    		AND EXISTS ( SELECT id FROM most_recent_snapshot_of_each_status WHERE id = als.id) 
		AND (
			als.version > (	select 	version 
					from 	legal_snapshot_summary 
					where 	plan_id = als.plan_id 
						and isCurrentLegalVersion = true 
					order by version desc
					limit 1 
				   ) 
		      OR
			not exists (	select 	id 
					from 	legal_snapshot_summary 
					where 	plan_id = als.plan_id and isCurrentLegalVersion is not null
				   )
		    )
	THEN 'StaffView' 

	--staff mandatory initiated
	WHEN 	EXISTS ( SELECT id FROM PLAN p WHERE als.plan_id = id AND status_id = 22) 
    		AND EXISTS ( SELECT id 	FROM 	legal_snapshot_summary 
					WHERE 	id = als.id 
						and effective_legal_start is not null 
						and effective_legal_end is null) 
		AND (
			als.version > (	select 	version 
					from 	legal_snapshot_summary 
					where 	plan_id = als.plan_id 
						and isCurrentLegalVersion = true 
					order by version desc
					limit 1 
				   ) 
		      OR
			not exists (	select 	id 
					from 	legal_snapshot_summary 
					where 	plan_id = als.plan_id and isCurrentLegalVersion is not null
				   )
		    )
	THEN 'AHView' 

	--staff mandatory kicked to AH court
	WHEN 	EXISTS ( SELECT id 	FROM 	PLAN p 
					WHERE 	als.plan_id = id 
					AND 	status_id = 1 
					and 	Cast(als.snapshot ->> 'amendmentTypeId' AS INTEGER) = 2) 
    		AND als.snapshot_status_id = 22 
    		AND EXISTS ( SELECT id FROM most_recent_snapshot_of_each_status WHERE id = als.id) 
		AND (
			als.version > (	select 	version 
					from 	legal_snapshot_summary 
					where 	plan_id = als.plan_id 
						and isCurrentLegalVersion = true 
					order by version desc
					limit 1 
				   ) 
		      OR
			not exists (	select 	id 
					from 	legal_snapshot_summary 
					where 	plan_id = als.plan_id and isCurrentLegalVersion is not null
				   )
		    )
	THEN 'StaffView' 

	--staff mandatory getting signed
	WHEN 	EXISTS ( SELECT id 	FROM 	PLAN p 
					WHERE 	als.plan_id = id 
					AND 	status_id = 18 
					and 	Cast(als.snapshot ->> 'amendmentTypeId' AS INTEGER) = 2) 
    		AND als.snapshot_status_id = 22 
    		AND EXISTS ( SELECT id FROM most_recent_snapshot_of_each_status WHERE id = als.id) 
		AND (
			als.version > (	select 	version 
					from 	legal_snapshot_summary 
					where 	plan_id = als.plan_id 
						and isCurrentLegalVersion = true 
					order by version desc
					limit 1 
				   ) 
		      OR
			not exists (	select 	id 
					from 	legal_snapshot_summary 
					where 	plan_id = als.plan_id and isCurrentLegalVersion is not null
				   )
		    )
	THEN 'StaffView' 

	--ah minor initiated
	WHEN 	EXISTS ( SELECT id FROM PLAN p 
			           WHERE als.plan_id = id 
				   AND status_id = 23)
    		AND EXISTS ( SELECT id 	FROM 	legal_snapshot_summary 
					WHERE 	id = als.id 
						and effective_legal_start is not null 
						and effective_legal_end is null) 
		AND (
			als.version > (	select 	version 
					from 	legal_snapshot_summary 
					where 	plan_id = als.plan_id 
						and isCurrentLegalVersion = true 
					order by version desc
					limit 1 
				   ) 
		      OR
			not exists (	select 	id 
					from 	legal_snapshot_summary 
					where 	plan_id = als.plan_id and isCurrentLegalVersion is not null
				   )
		    )
	THEN 'StaffView' 

	--ah minor awaiting signatures
	WHEN 	EXISTS ( SELECT id FROM PLAN p 
			           WHERE als.plan_id = id 
				   AND status_id = 18 
					and 	Cast(als.snapshot ->> 'amendmentTypeId' AS INTEGER) = 1) 
    		AND EXISTS ( SELECT id 	FROM 	legal_snapshot_summary 
					WHERE 	id = als.id 
						and effective_legal_start is not null 
						and effective_legal_end is null) 
		AND (
			als.version > (	select 	version 
					from 	legal_snapshot_summary 
					where 	plan_id = als.plan_id 
						and isCurrentLegalVersion = true 
					order by version desc
					limit 1 
				   ) 
		      OR
			not exists (	select 	id 
					from 	legal_snapshot_summary 
					where 	plan_id = als.plan_id and isCurrentLegalVersion is not null
				   )
		    )
	THEN 'StaffView' 
	ELSE NULL
    END AS privacyView 
  FROM 
    all_snapshots als
)
SELECT 
  all_snapshots.id, 
  all_snapshots.plan_id, 
  all_snapshots.created_at, 
  all_snapshots.snapshot,
  all_snapshots.version, 
  all_snapshots.snapshot_status_id AS status_id, 
  all_snapshots.user_id, 
  legal_version_reason.legal_reason,
  legal_version_reason.associated_legal_id,
  legal_snapshot_summary.isCurrentLegalVersion, 
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
  LEFT JOIN legal_version_reason on  legal_version_reason.id = all_snapshots.id 
  LEFT JOIN privacy_versions ON privacy_versions.id = all_snapshots.id 
  JOIN PLAN p ON p.id = all_snapshots.plan_id
order by version desc
);`)
  
};
