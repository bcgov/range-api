//
// MyRA
//
// Copyright © 2020 Province of British Columbia
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// Created by Micheal Wells on 2020-04-03.
//

'use strict';

exports.up = async function(knex) {

    const create_plan_conf_records = `
    CREATE FUNCTION update_plan_conf_to_reflect_client_agreement() 
    RETURNS trigger as  $$
    BEGIN

    IF (TG_OP = 'INSERT') THEN
    
        with plans_existing_for_this_client_id as
        (select     id, 
                    agreement_id,
                    NEW.client_id as client_id
        from        plan 
        where       agreement_id = NEW.agreement_id
        group by    id, agreement_id, client_id)

        insert into plan_confirmation (plan_id, client_id, confirmed)
        select      id, 
                    client_id,
                    'f'
        from        plans_existing_for_this_client_id;

        RETURN NEW;

    ELSEIF (TG_OP = 'DELETE') THEN

        with plan_conf_to_delete as
        (select     pc.id
        from        plan p
        join        plan_confirmation pc on pc.plan_id = p.id
        where       agreement_id = OLD.agreement_id
                    and pc.client_id  = OLD.client_id
        )

        delete from plan_confirmation 
        where id in (select id from plan_conf_to_delete);

        RETURN OLD;
    END IF;
        
    END;
    $$ LANGUAGE plpgsql
    `

    await knex.schema.raw(create_plan_conf_records);

    const insert_trigger = `
    CREATE TRIGGER update_plan_conf_with_new_client_agreement AFTER INSERT 
    ON client_agreement FOR EACH ROW EXECUTE PROCEDURE
    update_plan_conf_to_reflect_client_agreement()
    `;

    await knex.schema.raw(insert_trigger);
  
    const delete_trigger = `
    CREATE TRIGGER update_plan_conf_with_old_client_agreement AFTER DELETE 
    ON client_agreement FOR EACH ROW EXECUTE PROCEDURE
    update_plan_conf_to_reflect_client_agreement()
    `;

    await knex.schema.raw(delete_trigger);
};

exports.down = async function(knex) {
 knex.raw(`drop function if exists update_plan_conf_to_reflect_client_agreement() cascade;`)
};
