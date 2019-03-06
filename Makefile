#!make
# ------------------------------------------------------------------------------
# Makefile -- HA Flight Ops
# ------------------------------------------------------------------------------

include .env

export $(shell sed 's/=.*//' .env)
export GIT_LOCAL_BRANCH?=$(shell git rev-parse --abbrev-ref HEAD)
export DEPLOY_DATE?=$(shell date '+%Y%m%d%H%M')

define deployTag
"${PROJECT}-${GIT_LOCAL_BRANCH}-${DEPLOY_DATE}"
endef

ifndef PROJECT
$(error The PROJECT variable is missing.)
endif

ifndef ENVIRONMENT
$(error The ENVIRONMENT variable is missing.)
endif



#ifndef BUILD_TARGET
#$(error The BUILD_TARGET variable is missing.)
#endif

DIR := ${CURDIR}

all 		: help
.DEFAULT 	: help
.PHONY	    : local database close-local clean-local close-production  print-status

# ------------------------------------------------------------------------------
# Task Aliases
# ------------------------------------------------------------------------------

local:      |  print-status  build-local run-local         ## Task-Alias -- Run the steps for a local-build.
local-debug: | print-status build-local run-debug


# ------------------------------------------------------------------------------
# Status Output
# ------------------------------------------------------------------------------

print-status:
	@echo " +---------------------------------------------------------+ "
	@echo " | Current Settings                                        | "
	@echo " +---------------------------------------------------------+ "
	@echo " | PROJECT:      $(PROJECT) "
	@echo " | BRANCH:       $(GIT_LOCAL_BRANCH) "
	@echo " +---------------------------------------------------------+ "
	@echo " | BUILD_TARGET: $(BUILD_TARGET) "
	@echo " +---------------------------------------------------------+ "
	@echo " | Docker-Compose Config Output "
	@echo " +---------------------------------------------------------+ "


# ------------------------------------------------------------------------------
# Development Commands
# ------------------------------------------------------------------------------

local-env:
	@echo "+\n++ Preparing project for local development ...\n+"

build-local: ## -- Target : Builds the local development containers.
	@echo "+\n++ Make: Building local Docker image ...\n+"
	@docker-compose -f docker-compose.yml build 

setup-local: ## -- Target : Prepares the environment variables for local development.
	@echo "+\n++ Make: Preparing project for local development ...\n+"
	@cp .config/.env.dev .env
	@mkdir -p ./_app_data

run-local: ## -- Target : Runs the local development containers.
	@echo "+\n++ Make: Running locally ...\n+"
	@docker-compose -f docker-compose.yml up -d

run-debug: ## -- Target : Runs the local development containers.
	@echo "+\n++ Make: Running locally for debugging...\n+"
	@docker-compose -f docker-compose.yml up


close-local: ## -- Target : Closes the local development containers.
	@echo "+\n++ Make: Closing local container ...\n+"
	@docker-compose -f docker-compose.yml down


clean-local: ## -- Target : Closes and clean local development containers.
	@echo "+\n++ Make: Closing and cleaning local container ...\n+"
	@docker-compose -f docker-compose.yml down -v
	@rm -rf ./_app_data

seed-local:
	@echo "+\n++ Make: Seeding local database ...\n+"
	@docker-compose -f docker-compose.yml run range_api npm run initialize_docker



# ------------------------------------------------------------------------------
# Helper Commands
# ------------------------------------------------------------------------------
	
database: ## <Helper> :: Executes into database container.
	@echo "Make: Shelling into local database container ..."
	@docker-compose -f docker-compose.yml exec db psql -U $(POSTGRESQL_USER) -W $(POSTGRESQL_DATABASE)

workspace: ## <Workspcae> :: Excute into API container
	@echo "Make: Shelling into local api container ..."
	@docker-compose -f docker-compose.yml exec range_api bash



help:  ## ** Display this help screen.
	@grep -h -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'