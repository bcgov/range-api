with the_right_clients as ( 
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
    where concat(a.client_id,':',c.id) not in (select GUID from actual_clients_in_plan_confirmation)
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
select name, agreement_id, client_id, plan_id, reason
from missing_clients_in_plan_confirmation
union
select name, agreement_id, client_id, plan_id, reason
from old_clients_in_plan_confirmation
