#!/bin/bash
set -euo pipefail

# Refreshes target Crunchy DB from prod Crunchy DB.
#
# Crunchy DB pods mount /tmp as an emptyDir limited to 16Mi; writing a dump there
# gets the pod evicted (and fails over prod). The dump is streamed to this job's
# container instead and staged on the target primary's data volume.
#
# Usage:
#   ./openshift/range_refresh_dev_postgres.sh
#   TARGET_PROJECT=3187b2-test TARGET_CLUSTER=range-pg17-test ./openshift/range_refresh_dev_postgres.sh

SOURCE_PROJECT="${SOURCE_PROJECT:-3187b2-prod}"
SOURCE_CLUSTER="${SOURCE_CLUSTER:-range-pg17-prod}"
TARGET_PROJECT="${TARGET_PROJECT:-3187b2-dev}"
TARGET_CLUSTER="${TARGET_CLUSTER:-range-pg17-dev}"
DB_NAME="${DB_NAME:-myra}"
DUMP_RETRIES="${DUMP_RETRIES:-3}"
DUMP_RETRY_WAIT_SECONDS="${DUMP_RETRY_WAIT_SECONDS:-60}"
RESTORE_RETRIES="${RESTORE_RETRIES:-2}"
RESTORE_RETRY_WAIT_SECONDS="${RESTORE_RETRY_WAIT_SECONDS:-20}"
READY_TIMEOUT_SECONDS="${READY_TIMEOUT_SECONDS:-180}"
DB_CONTAINER_NAME="${DB_CONTAINER_NAME:-database}"
TRIGGER_MIGRATE_PIPELINE="${TRIGGER_MIGRATE_PIPELINE:-true}"
MIGRATE_PIPELINE_NAME="${MIGRATE_PIPELINE_NAME:-migrate-data-up}"
MIGRATE_PIPELINE_SERVICE_ACCOUNT="${MIGRATE_PIPELINE_SERVICE_ACCOUNT:-pipeline}"
TARGET_DUMP_DIR="${TARGET_DUMP_DIR:-/pgdata}"
REPLICA_SYNC_TIMEOUT_SECONDS="${REPLICA_SYNC_TIMEOUT_SECONDS:-900}"

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

print_pod_diagnostics() {
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

  echo "Pod diagnostics for ${project}/${pod}: restartCount=${restart_count:-none}, lastTerminatedReason=${terminated_reason:-none}, lastTerminatedExitCode=${terminated_exit_code:-none}, waitingReason=${waiting_reason:-none}"
}

get_pod_restart_count() {
  local project="$1"
  local pod="$2"

  oc -n "${project}" get pod "${pod}" \
    -o jsonpath="{.status.containerStatuses[?(@.name==\"${DB_CONTAINER_NAME}\")].restartCount}" 2>/dev/null || echo "unknown"
}

is_pod_primary() {
  local project="$1"
  local pod="$2"

  local in_recovery
  in_recovery=$(oc -n "${project}" exec "${pod}" -c "${DB_CONTAINER_NAME}" -- \
    psql -U postgres -d "${DB_NAME}" -tAc "SELECT pg_is_in_recovery();" 2>/dev/null || echo "unknown")
  [ "${in_recovery}" = "f" ]
}

# Prints "<patroni cluster> <member>" for each replica that is not streaming with zero replay lag.
get_unhealthy_replicas() {
  local project="$1"
  local pod="$2"
  local tsv

  tsv="$(oc -n "${project}" exec "${pod}" -c "${DB_CONTAINER_NAME}" -- patronictl list -f tsv 2>/dev/null || true)"
  if [ -z "${tsv}" ]; then
    echo "? ?"
    return 0
  fi

  while IFS=$'\t' read -r cluster member _host role state _tl _receive_lsn _receive_lag _replay_lsn replay_lag; do
    if [ "${role}" = "Replica" ] || [ "${role}" = "Sync Standby" ]; then
      if [ "${state}" != "streaming" ] || [ "${replay_lag}" != "0" ]; then
        echo "${cluster} ${member}"
      fi
    fi
  done <<<"${tsv}"
}

wait_for_replicas() {
  local project="$1"
  local pod="$2"
  local timeout_seconds="$3"
  local deadline=$((SECONDS + timeout_seconds))
  local unhealthy

  while [ "${SECONDS}" -lt "${deadline}" ]; do
    unhealthy="$(get_unhealthy_replicas "${project}" "${pod}")"
    if [ -z "${unhealthy}" ]; then
      return 0
    fi
    sleep 15
  done

  echo "Replicas not caught up after ${timeout_seconds}s:"
  echo "${unhealthy}"
  return 1
}

# A large restore can outrun WAL retention on the replicas; rebuild any that fall behind.
ensure_replicas_healthy() {
  local project="$1"
  local cluster="$2"

  local pod
  pod="$(get_primary_pod "${project}" "${cluster}")"
  echo "Waiting for replicas of ${project}/${cluster} to catch up..."
  if wait_for_replicas "${project}" "${pod}" "${REPLICA_SYNC_TIMEOUT_SECONDS}"; then
    echo "All replicas are streaming."
    return 0
  fi

  local patroni_cluster member
  while read -r patroni_cluster member; do
    if [ -z "${member}" ] || [ "${member}" = "?" ]; then
      continue
    fi
    echo "Reinitializing replica ${member}..."
    oc -n "${project}" exec "${pod}" -c "${DB_CONTAINER_NAME}" -- \
      patronictl reinit "${patroni_cluster}" "${member}" --force || echo "Warning: reinit of ${member} failed."
  done <<<"$(get_unhealthy_replicas "${project}" "${pod}")"

  if wait_for_replicas "${project}" "${pod}" "${REPLICA_SYNC_TIMEOUT_SECONDS}"; then
    echo "All replicas are streaming after reinit."
    return 0
  fi

  echo "Error: replicas of ${project}/${cluster} are still unhealthy after reinit."
  return 1
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
TARGET_DUMP_FILE="${TARGET_DUMP_DIR}/${DB_NAME}.refresh.dump"

cleanup() {
  # The primary may have changed during the restore, so clean every target instance.
  local target_pods
  target_pods="$(oc -n "${TARGET_PROJECT}" get pod \
    -l "postgres-operator.crunchydata.com/cluster=${TARGET_CLUSTER},postgres-operator.crunchydata.com/role" \
    -o jsonpath='{.items[*].metadata.name}' 2>/dev/null || true)"
  for pod in ${target_pods}; do
    oc -n "${TARGET_PROJECT}" exec "${pod}" -c "${DB_CONTAINER_NAME}" -- rm -f "${TARGET_DUMP_FILE}" >/dev/null 2>&1 || true
  done
  rm -f "${LOCAL_DUMP_FILE}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

is_valid_dump() {
  [ -s "${LOCAL_DUMP_FILE}" ] && [ "$(head -c 5 "${LOCAL_DUMP_FILE}")" = "PGDMP" ]
}

echo "Dumping ${DB_NAME} from ${SOURCE_PROJECT}/${SOURCE_CLUSTER}..."
dump_attempt=1
while [ "${dump_attempt}" -le "${DUMP_RETRIES}" ]; do
  SOURCE_PRIMARY_POD="$(get_primary_pod "${SOURCE_PROJECT}" "${SOURCE_CLUSTER}")"
  if [ -z "${SOURCE_PRIMARY_POD}" ]; then
    echo "Dump attempt ${dump_attempt}/${DUMP_RETRIES} failed: source primary pod not found."
  else
    echo "Dump attempt ${dump_attempt}/${DUMP_RETRIES} from source primary pod: ${SOURCE_PRIMARY_POD}"

    if ! is_pod_primary "${SOURCE_PROJECT}" "${SOURCE_PRIMARY_POD}"; then
      echo "Warning: ${SOURCE_PRIMARY_POD} does not report as primary (label lag or failover in progress); re-resolving next attempt."
    else
      source_restarts_before="$(get_pod_restart_count "${SOURCE_PROJECT}" "${SOURCE_PRIMARY_POD}")"
      # Stream to stdout: nothing is written inside the source pod.
      if oc -n "${SOURCE_PROJECT}" exec "${SOURCE_PRIMARY_POD}" -c "${DB_CONTAINER_NAME}" -- \
        env PGOPTIONS="-c statement_timeout=0" \
        pg_dump -U postgres -d "${DB_NAME}" --format=custom --no-owner --no-privileges >"${LOCAL_DUMP_FILE}" &&
        is_valid_dump; then
        echo "Dump completed successfully ($(wc -c <"${LOCAL_DUMP_FILE}") bytes)."
        break
      fi

      echo "Dump attempt ${dump_attempt} failed."
      print_pod_diagnostics "${SOURCE_PROJECT}" "${SOURCE_PRIMARY_POD}"
      source_restarts_after="$(get_pod_restart_count "${SOURCE_PROJECT}" "${SOURCE_PRIMARY_POD}")"
      if [ "${source_restarts_before}" != "${source_restarts_after}" ]; then
        echo "Source database container restarted during the dump (restartCount ${source_restarts_before} -> ${source_restarts_after}); likely OOM or failover."
      fi
    fi
  fi

  if [ "${dump_attempt}" -lt "${DUMP_RETRIES}" ]; then
    echo "Waiting ${DUMP_RETRY_WAIT_SECONDS}s before next dump attempt..."
    sleep "${DUMP_RETRY_WAIT_SECONDS}"
  fi

  dump_attempt=$((dump_attempt + 1))
done

if [ "${dump_attempt}" -gt "${DUMP_RETRIES}" ]; then
  echo "Database dump failed after ${DUMP_RETRIES} attempts."
  exit 1
fi

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

    echo "Copying dump to target ${TARGET_DUMP_FILE}..."
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
  workspaces:
  - name: openshift-pineline
    emptyDir: {}
PIPELINE_EOF
      fi

      if ! ensure_replicas_healthy "${TARGET_PROJECT}" "${TARGET_CLUSTER}"; then
        echo "Database data was refreshed, but ${TARGET_PROJECT}/${TARGET_CLUSTER} replicas need attention."
        exit 1
      fi

      echo "Database refresh completed successfully."
      exit 0
    fi

    echo "Restore attempt ${attempt} failed."
    print_pod_diagnostics "${TARGET_PROJECT}" "${TARGET_PRIMARY_POD}"
  fi

  if [ "${attempt}" -lt "${RESTORE_RETRIES}" ]; then
    echo "Waiting ${RESTORE_RETRY_WAIT_SECONDS}s before retry..."
    sleep "${RESTORE_RETRY_WAIT_SECONDS}"
  fi

  attempt=$((attempt + 1))
done

echo "Database refresh failed after ${RESTORE_RETRIES} attempts."
exit 1
