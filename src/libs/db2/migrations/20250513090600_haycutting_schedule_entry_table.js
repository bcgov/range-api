exports.up = async (knex) => {
  await knex.raw(`
    CREATE TABLE haycutting_schedule_entry (
      id serial4 NOT NULL,
      haycutting_schedule_id int4 NOT NULL,
      pasture_id int4 NOT NULL,
      date_in timestamptz NULL,
      date_out timestamptz NULL,
      stubble_height int4 NOT NULL,
      tonnes int4 NOT NULL,
      created_at timestamptz DEFAULT 'now'::text::timestamp(3) with time zone NOT NULL,
      updated_at timestamptz DEFAULT 'now'::text::timestamp(3) with time zone NOT NULL,
      canonical_id int4 NULL,
      CONSTRAINT haycutting_schedule_entry_pkey PRIMARY KEY (id)
    );

    CREATE INDEX haycutting_schedule_entry_haycutting_schedule_id_index ON haycutting_schedule_entry USING btree (haycutting_schedule_id);
    CREATE INDEX haycutting_schedule_entry_pasture_id_index ON haycutting_schedule_entry USING btree (pasture_id);

    create trigger update_haycutting_schedule_entry_changetimestamp before
    update
        on
        haycutting_schedule_entry for each row execute function update_changetimestamp_column();

    ALTER TABLE haycutting_schedule_entry ADD CONSTRAINT haycutting_schedule_entry_haycutting_schedule_id_foreign FOREIGN KEY (haycutting_schedule_id) REFERENCES grazing_schedule(id) ON DELETE CASCADE;
    ALTER TABLE haycutting_schedule_entry ADD CONSTRAINT haycutting_schedule_entry_pasture_id_foreign FOREIGN KEY (pasture_id) REFERENCES pasture(id) ON DELETE CASCADE;
  `);

  await knex.raw(`
    UPDATE plan_snapshot
    SET snapshot = jsonb_set(
      snapshot::jsonb - 'grazingSchedules',       -- Remove the old key
      '{schedules}', 
      (snapshot::jsonb)->'grazingSchedules'       -- Add it back as 'schedules'
    )
    WHERE (snapshot::jsonb) \\? 'grazingSchedules';

    DO $$
    DECLARE
      rec RECORD;
      updated_snapshot JSONB;
      schedule_json RECORD;
      schedule_obj JSONB;
      entry_json RECORD;
      new_schedules JSONB;
      new_entries JSONB;
    BEGIN
      FOR rec IN
        SELECT id, snapshot::jsonb AS snapshot FROM plan_snapshot
        WHERE snapshot::jsonb \\? 'schedules'
      LOOP
        new_schedules := '[]'::jsonb;

        -- Loop over each schedule in the schedules array
        FOR schedule_json IN
          SELECT value FROM jsonb_array_elements(rec.snapshot->'schedules')
        LOOP
          schedule_obj := schedule_json.value;
          new_entries := '[]'::jsonb;

          -- If the schedule contains grazingScheduleEntries
          IF schedule_obj \\? 'grazingScheduleEntries' THEN
            FOR entry_json IN
              SELECT value FROM jsonb_array_elements(schedule_obj->'grazingScheduleEntries')
            LOOP
              new_entries := new_entries || jsonb_set(
                entry_json.value - 'grazingScheduleId',
                '{scheduleId}',
                entry_json.value->'grazingScheduleId'
              );
            END LOOP;

            -- Replace grazingScheduleEntries → scheduleEntries
            schedule_obj := jsonb_set(
              schedule_obj - 'grazingScheduleEntries',
              '{scheduleEntries}',
              new_entries
            );
          END IF;

          new_schedules := new_schedules || schedule_obj;
        END LOOP;

        updated_snapshot := jsonb_set(
          rec.snapshot,
          '{schedules}',
          new_schedules
        );

        UPDATE plan_snapshot
        SET snapshot = updated_snapshot
        WHERE id = rec.id;

        RAISE NOTICE 'Updated snapshot ID %', rec.id;
      END LOOP;
    END $$;
  `);
};

exports.down = async () => {};
