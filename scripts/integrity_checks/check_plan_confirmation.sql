with current_plans as  (
    select max(id) as id, agreement_id 
    from plan
    group by agreement_id
),
the_right_clients as ( 
select b.name, 
       c.agreement_id,
       b.id as client_id,
    c.id as plan_id,
       concat(b.id,':', c.id) as GUID
from        client_agreement a 
join        ref_client b  on b.id = a.client_id
join        plan c on c.agreement_id = a.agreement_id
),
actual_clients_in_plan_confirmation  as (
    select b.name,
            a.id as plan_conf_id,
            a.client_id,
            c.agreement_id,
            c.id as plan_id,
            concat(a.client_id,':',c.id) as GUID
    from plan_confirmation a
    join plan c on c.id = a.plan_id
    join ref_client b on b.id = a.client_id
),
old_clients_in_plan_confirmation  as (
    select b.name,
            a.id as plan_conf_id,
            a.client_id,
            c.agreement_id,
            c.id as plan_id,
            concat(a.client_id,':',c.id) as GUID,
            'old AH'::text as reason
    from plan_confirmation a
    join plan c on c.id = a.plan_id
    left join ref_client b on b.id = a.client_id
    where concat(a.client_id,':',c.id) not in (select GUID from the_right_clients)
)
,missing_clients_in_plan_confirmation as (
  select name,
        client_id,
        agreement_id,
        plan_id,
        GUID,
        'missing'::text as reason
        from the_right_clients
        where GUID not in (select GUID from actual_clients_in_plan_confirmation)
    )
select b.name, agreement_id, client_id, plan_id, b.client_number, b.location_code, reason
from missing_clients_in_plan_confirmation
join ref_client b on client_id = b.id
where plan_id in (select id from current_plans)
union
select b.name, agreement_id, client_id, plan_id, b.client_number, b.location_code, reason
from old_clients_in_plan_confirmation
join ref_client b on client_id = b.id
where plan_id in (select id from current_plans)
order by agreement_id desc
