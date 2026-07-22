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
RESTORE_RETRIES="${RESTORE_RETRIES:-2}"
RESTORE_RETRY_WAIT_SECONDS="${RESTORE_RETRY_WAIT_SECONDS:-20}"
READY_TIMEOUT_SECONDS="${READY_TIMEOUT_SECONDS:-180}"
DB_CONTAINER_NAME="${DB_CONTAINER_NAME:-database}"
TRIGGER_MIGRATE_PIPELINE="${TRIGGER_MIGRATE_PIPELINE:-true}"
MIGRATE_PIPELINE_NAME="${MIGRATE_PIPELINE_NAME:-migrate-data-up}"
MIGRATE_PIPELINE_SERVICE_ACCOUNT="${MIGRATE_PIPELINE_SERVICE_ACCOUNT:-pipeline}"

get_primary_pod() {
  local project="$1"
  local cluster="$2"

  oc -n "${project}" get pod \
    -l "postgres-operator.crunchydata.com/cluster=${cluster},postgres-operator.crunchydata.com/role=master" \
    -o jsonpath='{.items[0].metadata.name}'
}

wait_for_database_container() {
  local project="$1"
  local pod="$2"
  local timeout_seconds="$3"
  local deadline=$((SECONDS + timeout_seconds))

  while [ "${SECONDS}" -lt "${deadline}" ]; do
    local status
    status=$(oc -n "${project}" get pod "${pod}" \
      -o jsonpath="{range .status.containerStatuses[?(@.name==\"${DB_CONTAINER_NAME}\")]}{.ready}:{.state.waiting.reason}:{.state.terminated.reason}{end}" \
      2>/dev/null || true)

    if [ -n "${status}" ] && [[ "${status}" == true:* ]]; then
      return 0
    fi

    sleep 5
  done

  return 1
}

print_target_pod_diagnostics() {
  local project="$1"
  local pod="$2"

  local restart_count
  local terminated_reason
  local terminated_exit_code
  local waiting_reason

  restart_count=$(oc -n "${project}" get pod "${pod}" \
    -o jsonpath="{range .status.containerStatuses[?(@.name==\"${DB_CONTAINER_NAME}\")]}{.restartCount}{end}" 2>/dev/null || true)
  terminated_reason=$(oc -n "${project}" get pod "${pod}" \
    -o jsonpath="{range .status.containerStatuses[?(@.name==\"${DB_CONTAINER_NAME}\")]}{.lastState.terminated.reason}{end}" 2>/dev/null || true)
  terminated_exit_code=$(oc -n "${project}" get pod "${pod}" \
    -o jsonpath="{range .status.containerStatuses[?(@.name==\"${DB_CONTAINER_NAME}\")]}{.lastState.terminated.exitCode}{end}" 2>/dev/null || true)
  waiting_reason=$(oc -n "${project}" get pod "${pod}" \
    -o jsonpath="{range .status.containerStatuses[?(@.name==\"${DB_CONTAINER_NAME}\")]}{.state.waiting.reason}{end}" 2>/dev/null || true)

  echo "Target pod diagnostics: restartCount=${restart_count:-none}, lastTerminatedReason=${terminated_reason:-none}, lastTerminatedExitCode=${terminated_exit_code:-none}, waitingReason=${waiting_reason:-none}"
}

SOURCE_PRIMARY_POD="$(get_primary_pod "${SOURCE_PROJECT}" "${SOURCE_CLUSTER}")"
TARGET_PRIMARY_POD="$(get_primary_pod "${TARGET_PROJECT}" "${TARGET_CLUSTER}")"

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
  oc -n "${SOURCE_PROJECT}" exec "${SOURCE_PRIMARY_POD}" -c "${DB_CONTAINER_NAME}" -- rm -f "${SOURCE_DUMP_FILE}" >/dev/null 2>&1 || true
  local cleanup_target_pod
  cleanup_target_pod="$(get_primary_pod "${TARGET_PROJECT}" "${TARGET_CLUSTER}" || true)"
  if [ -n "${cleanup_target_pod}" ]; then
    oc -n "${TARGET_PROJECT}" exec "${cleanup_target_pod}" -c "${DB_CONTAINER_NAME}" -- rm -f "${TARGET_DUMP_FILE}" >/dev/null 2>&1 || true
  fi
  rm -f "${LOCAL_DUMP_FILE}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "Dumping ${DB_NAME} from ${SOURCE_PROJECT}/${SOURCE_CLUSTER}..."
oc -n "${SOURCE_PROJECT}" exec "${SOURCE_PRIMARY_POD}" -c "${DB_CONTAINER_NAME}" -- \
  pg_dump -U postgres -d "${DB_NAME}" --format=custom --no-owner --no-privileges --file "${SOURCE_DUMP_FILE}"

echo "Copying dump to local..."
oc -n "${SOURCE_PROJECT}" cp "${SOURCE_PRIMARY_POD}:${SOURCE_DUMP_FILE}" "${LOCAL_DUMP_FILE}" -c "${DB_CONTAINER_NAME}"

echo "Restoring ${DB_NAME} into ${TARGET_PROJECT}/${TARGET_CLUSTER}..."
attempt=1
while [ "${attempt}" -le "${RESTORE_RETRIES}" ]; do
  TARGET_PRIMARY_POD="$(get_primary_pod "${TARGET_PROJECT}" "${TARGET_CLUSTER}")"

  if [ -z "${TARGET_PRIMARY_POD}" ]; then
    echo "Restore attempt ${attempt}/${RESTORE_RETRIES} failed: target primary pod not found."
  else
    echo "Restore attempt ${attempt}/${RESTORE_RETRIES}..."
    echo "Target primary pod: ${TARGET_PRIMARY_POD}"

    if ! wait_for_database_container "${TARGET_PROJECT}" "${TARGET_PRIMARY_POD}" "${READY_TIMEOUT_SECONDS}"; then
      echo "Warning: PostgreSQL in ${TARGET_PROJECT}/${TARGET_CLUSTER} did not become ready within ${READY_TIMEOUT_SECONDS}s."
    fi

    echo "Copying dump to target..."
    if oc -n "${TARGET_PROJECT}" cp "${LOCAL_DUMP_FILE}" "${TARGET_PRIMARY_POD}:${TARGET_DUMP_FILE}" -c "${DB_CONTAINER_NAME}" && \
      oc -n "${TARGET_PROJECT}" exec "${TARGET_PRIMARY_POD}" -c "${DB_CONTAINER_NAME}" -- \
        pg_restore -U postgres -d "${DB_NAME}" --clean --if-exists --no-owner --no-privileges "${TARGET_DUMP_FILE}"; then
      if [ "${TRIGGER_MIGRATE_PIPELINE}" = "true" ]; then
        echo "Triggering ${MIGRATE_PIPELINE_NAME} pipeline..."
        oc -n "${TARGET_PROJECT}" create -f - <<PIPELINE_EOF
apiVersion: tekton.dev/v1beta1
kind: PipelineRun
metadata:
  generateName: ${MIGRATE_PIPELINE_NAME}-run
spec:
  pipelineRef:
    name: ${MIGRATE_PIPELINE_NAME}
  serviceAccountName: ${MIGRATE_PIPELINE_SERVICE_ACCOUNT}
PIPELINE_EOF
      fi

      echo "Database refresh completed successfully."
      exit 0
    fi

    echo "Restore attempt ${attempt} failed."
    print_target_pod_diagnostics "${TARGET_PROJECT}" "${TARGET_PRIMARY_POD}"
  fi

  if [ "${attempt}" -lt "${RESTORE_RETRIES}" ]; then
    echo "Waiting ${RESTORE_RETRY_WAIT_SECONDS}s before retry..."
    sleep "${RESTORE_RETRY_WAIT_SECONDS}"
  fi

  attempt=$((attempt + 1))
done

echo "Database refresh failed after ${RESTORE_RETRIES} attempts."
exit 1
