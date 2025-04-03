#!/bin/bash

# Set variables for projects and deployment
DEV_PROJECT="3187b2-dev"
PROD_PROJECT="3187b2-prod"
DEPLOYMENT_PATTERN="range-postgresql"

# Get pod names using grep pattern for deployment
DEV_POD=$(oc -n ${DEV_PROJECT} get pods | grep ${DEPLOYMENT_PATTERN} | grep -v deploy | head -n 1 | awk '{print $1}')
PROD_POD=$(oc -n ${PROD_PROJECT} get pods | grep ${DEPLOYMENT_PATTERN} | grep -v deploy | head -n 1 | awk '{print $1}')

# Check if pods were found
if [ -z "$DEV_POD" ]; then
  echo "Error: Could not find PostgreSQL pod in ${DEV_PROJECT} project"
  exit 1
fi

if [ -z "$PROD_POD" ]; then
  echo "Error: Could not find PostgreSQL pod in ${PROD_PROJECT} project"
  exit 1
fi

echo "Development pod: ${DEV_POD}"
echo "Production pod: ${PROD_POD}"

# Get database names and credentials from environment variables for both environments
DEV_DB_NAME=$(oc -n ${DEV_PROJECT} exec ${DEV_POD} -- printenv POSTGRESQL_DATABASE)
DEV_DB_USER=$(oc -n ${DEV_PROJECT} exec ${DEV_POD} -- printenv POSTGRESQL_USER)
DEV_DB_PASSWORD=$(oc -n ${DEV_PROJECT} exec ${DEV_POD} -- printenv POSTGRESQL_PASSWORD)

PROD_DB_NAME=$(oc -n ${PROD_PROJECT} exec ${PROD_POD} -- printenv POSTGRESQL_DATABASE)
PROD_DB_USER=$(oc -n ${PROD_PROJECT} exec ${PROD_POD} -- printenv POSTGRESQL_USER)
PROD_DB_PASSWORD=$(oc -n ${PROD_PROJECT} exec ${PROD_POD} -- printenv POSTGRESQL_PASSWORD)

echo "Using development database: ${DEV_DB_NAME}"
echo "Using production database: ${PROD_DB_NAME}"

# Step 1: Drop and recreate public schema in dev database
echo "Dropping and recreating public schema in development database..."
oc -n ${DEV_PROJECT} exec ${DEV_POD} -- bash -c "PGPASSWORD=${DEV_DB_PASSWORD} psql -U ${DEV_DB_USER} ${DEV_DB_NAME} -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'"

# Step 2: Export data from production database
echo "Exporting data from production database..."
TIMESTAMP=$(date +%Y%m%d%H%M%S)

oc -n ${PROD_PROJECT} exec ${PROD_POD} -- bash -c "PGPASSWORD=${PROD_DB_PASSWORD} pg_dump -U ${PROD_DB_USER} -d ${PROD_DB_NAME} -n public -f /tmp/dump.sql"

# Step 3: Copy dumps from production to local machine
echo "Copying database dumps from production pod..."
oc -n ${PROD_PROJECT} cp ${PROD_POD}:/tmp/dump.sql /tmp/dump.sql

# Step 4: Copy dumps to development pod
echo "Copying database dumps to development pod..."
oc -n ${DEV_PROJECT} cp /tmp/dump.sql ${DEV_POD}:/tmp/dump.sql

# Step 5: Import data into development database
echo "Importing schema into development database..."
oc -n ${DEV_PROJECT} exec ${DEV_POD} -- bash -c "PGPASSWORD=${DEV_DB_PASSWORD} psql -U ${DEV_DB_USER} ${DEV_DB_NAME} -f /tmp/dump.sql"

# Step 6: Cleanup
echo "Cleaning up temporary files..."
oc -n ${PROD_PROJECT} exec ${PROD_POD} -- rm /tmp/dump.sql
oc -n ${DEV_PROJECT} exec ${DEV_POD} -- rm /tmp/dump.sql
rm /tmp/dump.sql

echo "Database refresh completed successfully!"
