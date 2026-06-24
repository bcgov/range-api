#!/bin/bash
set -euo pipefail

# Refreshes target Crunchy DB from prod Crunchy DB.
# Usage:
#   ./openshift/range_refresh_dev_postgres.sh
#   TARGET_PROJECT=3187b2-test TARGET_CLUSTER=range-pg17-test ./openshift/range_refresh_dev_postgres.sh

SOURCE_PROJECT="${SOURCE_PROJECT:-3187b2-prod}"
SOURCE_CLUSTER="${SOURCE_CLUSTER:-range-pg17-prod}"
TARGET_PROJECT="${TARGET_PROJECT:-3187b2-dev}"
TARGET_CLUSTER="${TARGET_CLUSTER:-range-pg17-dev}"
DB_NAME="${DB_NAME:-myra}"

SOURCE_PRIMARY_POD=$(oc -n "${SOURCE_PROJECT}" get pod \
  -l "postgres-operator.crunchydata.com/cluster=${SOURCE_CLUSTER},postgres-operator.crunchydata.com/role=master" \
  -o jsonpath='{.items[0].metadata.name}')

TARGET_PRIMARY_POD=$(oc -n "${TARGET_PROJECT}" get pod \
  -l "postgres-operator.crunchydata.com/cluster=${TARGET_CLUSTER},postgres-operator.crunchydata.com/role=master" \
  -o jsonpath='{.items[0].metadata.name}')

if [ -z "${SOURCE_PRIMARY_POD}" ]; then
  echo "Error: could not find source primary pod in ${SOURCE_PROJECT} for cluster ${SOURCE_CLUSTER}"
  exit 1
fi

if [ -z "${TARGET_PRIMARY_POD}" ]; then
  echo "Error: could not find target primary pod in ${TARGET_PROJECT} for cluster ${TARGET_CLUSTER}"
  exit 1
fi

echo "Source primary pod: ${SOURCE_PRIMARY_POD}"
echo "Target primary pod: ${TARGET_PRIMARY_POD}"
echo "Database: ${DB_NAME}"

LOCAL_DUMP_FILE="$(mktemp /tmp/${DB_NAME}.dump.XXXXXX)"
SOURCE_DUMP_FILE="/tmp/${DB_NAME}.dump"
TARGET_DUMP_FILE="/tmp/${DB_NAME}.dump"

cleanup() {
  oc -n "${SOURCE_PROJECT}" exec "${SOURCE_PRIMARY_POD}" -c database -- rm -f "${SOURCE_DUMP_FILE}" >/dev/null 2>&1 || true
  oc -n "${TARGET_PROJECT}" exec "${TARGET_PRIMARY_POD}" -c database -- rm -f "${TARGET_DUMP_FILE}" >/dev/null 2>&1 || true
  rm -f "${LOCAL_DUMP_FILE}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "Dumping ${DB_NAME} from ${SOURCE_PROJECT}/${SOURCE_CLUSTER}..."
oc -n "${SOURCE_PROJECT}" exec "${SOURCE_PRIMARY_POD}" -c database -- \
  pg_dump -U postgres -d "${DB_NAME}" --format=custom --no-owner --no-privileges --file "${SOURCE_DUMP_FILE}"

echo "Copying dump to local..."
oc -n "${SOURCE_PROJECT}" cp "${SOURCE_PRIMARY_POD}:${SOURCE_DUMP_FILE}" "${LOCAL_DUMP_FILE}" -c database

echo "Copying dump to target..."
oc -n "${TARGET_PROJECT}" cp "${LOCAL_DUMP_FILE}" "${TARGET_PRIMARY_POD}:${TARGET_DUMP_FILE}" -c database

echo "Restoring ${DB_NAME} into ${TARGET_PROJECT}/${TARGET_CLUSTER}..."
oc -n "${TARGET_PROJECT}" exec "${TARGET_PRIMARY_POD}" -c database -- \
  pg_restore -U postgres -d "${DB_NAME}" --clean --if-exists --no-owner --no-privileges "${TARGET_DUMP_FILE}"

echo "Database refresh completed successfully."
