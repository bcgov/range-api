exports.up = async function (knex) {
  await knex.raw(`
CREATE OR REPLACE FUNCTION plant_community_no_null_name()
RETURNS trigger AS
$BODY$
BEGIN
  IF NEW.name IS NULL THEN
    NEW.name = '';
  END IF;
  RETURN NEW;
END
$BODY$
LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION plant_community_action_no_null_name()
RETURNS trigger AS
$BODY$
BEGIN
  IF NEW.name IS NULL THEN
    NEW.name = '';
  END IF;
  RETURN NEW;
END
$BODY$
LANGUAGE plpgsql;

drop trigger if exists plant_community_name on plant_community;
drop trigger if exists plant_community_action_name on plant_community_action;

CREATE TRIGGER plant_community_name  BEFORE  insert OR update
    ON plant_community
    For each row
    EXECUTE FUNCTION plant_community_no_null_name();

CREATE TRIGGER plant_community_action_name  BEFORE  insert OR update 
    ON plant_community_action
    EXECUTE FUNCTION plant_community_action_no_null_name();
`);

};

exports.down = async function (knex) {

};
