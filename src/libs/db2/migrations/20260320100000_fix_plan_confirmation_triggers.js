'use strict';

exports.up = async function (knex) {
  const createTriggerFunction = `
    DROP FUNCTION IF EXISTS update_plan_conf_to_reflect_client_agreement() CASCADE;
    CREATE FUNCTION update_plan_conf_to_reflect_client_agreement()
    RETURNS trigger AS $$
    BEGIN
      IF (TG_OP = 'INSERT') THEN
        -- Check if plan_confirmations already exist for this client/plan combination
        IF NOT EXISTS (
          SELECT 1 FROM plan_confirmation pc
          JOIN plan p ON pc.plan_id = p.id
          WHERE p.agreement_id = NEW.agreement_id
          AND pc.client_id = NEW.client_id
        ) THEN
          -- Insert plan_confirmations for all existing plans under this agreement
          INSERT INTO plan_confirmation (plan_id, client_id, confirmed)
          SELECT p.id, NEW.client_id, 'f'
          FROM plan p
          WHERE p.agreement_id = NEW.agreement_id;
        END IF;
        RETURN NEW;

      ELSIF (TG_OP = 'DELETE') THEN
        -- Delete plan_confirmations for this client/agreement
        DELETE FROM plan_confirmation
        WHERE client_id = OLD.client_id
        AND plan_id IN (SELECT id FROM plan WHERE agreement_id = OLD.agreement_id);
        RETURN OLD;

      ELSIF (TG_OP = 'UPDATE') THEN
        -- Handle client_id change: update existing plan_confirmations
        UPDATE plan_confirmation
        SET client_id = NEW.client_id,
            updated_at = NOW()
        WHERE client_id = OLD.client_id
        AND plan_id IN (SELECT id FROM plan WHERE agreement_id = OLD.agreement_id);

        -- Also check if new client already has confirmations for these plans
        -- and if not, create them (handles case where old confirmations were deleted)
        INSERT INTO plan_confirmation (plan_id, client_id, confirmed)
        SELECT p.id, NEW.client_id, 'f'
        FROM plan p
        WHERE p.agreement_id = NEW.agreement_id
        AND NOT EXISTS (
          SELECT 1 FROM plan_confirmation pc
          WHERE pc.plan_id = p.id AND pc.client_id = NEW.client_id
        );
        RETURN NEW;
      END IF;
    END;
    $$ LANGUAGE plpgsql
  `;

  await knex.schema.raw(createTriggerFunction);

  const insertTrigger = `
    DROP TRIGGER IF EXISTS update_plan_conf_with_new_client_agreement ON client_agreement;
    CREATE TRIGGER update_plan_conf_with_new_client_agreement
    AFTER INSERT ON client_agreement
    FOR EACH ROW EXECUTE PROCEDURE update_plan_conf_to_reflect_client_agreement()
  `;

  await knex.schema.raw(insertTrigger);

  const deleteTrigger = `
    DROP TRIGGER IF EXISTS update_plan_conf_with_old_client_agreement ON client_agreement;
    CREATE TRIGGER update_plan_conf_with_old_client_agreement
    AFTER DELETE ON client_agreement
    FOR EACH ROW EXECUTE PROCEDURE update_plan_conf_to_reflect_client_agreement()
  `;

  await knex.schema.raw(deleteTrigger);

  const updateTrigger = `
    DROP TRIGGER IF EXISTS update_plan_conf_with_client_agreement_update ON client_agreement;
    CREATE TRIGGER update_plan_conf_with_client_agreement_update
    AFTER UPDATE ON client_agreement
    FOR EACH ROW EXECUTE PROCEDURE update_plan_conf_to_reflect_client_agreement()
  `;

  await knex.schema.raw(updateTrigger);
};

exports.down = async function (knex) {
  await knex.schema.raw(`
    DROP TRIGGER IF EXISTS update_plan_conf_with_new_client_agreement ON client_agreement;
    DROP TRIGGER IF EXISTS update_plan_conf_with_old_client_agreement ON client_agreement;
    DROP TRIGGER IF EXISTS update_plan_conf_with_client_agreement_update ON client_agreement;
    DROP FUNCTION IF EXISTS update_plan_conf_to_reflect_client_agreement() CASCADE;
  `);
};
