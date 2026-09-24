-- =========================================================================
-- Fix legacy grazing_schedule_entry rows whose date_in/date_out year does
-- not match their grazing_schedule's year.
--
-- Root cause: several plans had future/past years' grazing schedules
-- bulk-created by copying an existing year's schedule entries verbatim,
-- without updating the copied date_in/date_out to the new schedule's year
-- (e.g. plan RAN074721 / plan_id 1312's 2022 and 2023 schedules still had
-- 2021 dates). This went unnoticed until PlanScheduleController.validateEntryDates
-- started enforcing "dateIn year === schedule year" on every schedule save,
-- which now blocks saving/status-changing these plans (see #<issue-number>).
--
-- Fix: shift date_in/date_out by the whole-year delta needed to align
-- date_in's UTC year with the schedule's year, preserving month/day/time.
-- =========================================================================

-- migrate:up
UPDATE grazing_schedule_entry gse
SET
  date_in = gse.date_in + make_interval(years => (gs.year - EXTRACT(YEAR FROM (gse.date_in AT TIME ZONE 'UTC'))::int)),
  date_out = CASE
    WHEN gse.date_out IS NULL THEN NULL
    ELSE gse.date_out + make_interval(years => (gs.year - EXTRACT(YEAR FROM (gse.date_in AT TIME ZONE 'UTC'))::int))
  END
FROM grazing_schedule gs
WHERE gs.id = gse.grazing_schedule_id
  AND gse.date_in IS NOT NULL
  AND EXTRACT(YEAR FROM (gse.date_in AT TIME ZONE 'UTC')) <> gs.year;

-- migrate:down
-- Not reversible: the original (incorrect) dates are not recoverable from
-- this migration alone.
SELECT 1;
