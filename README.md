[![img](https://img.shields.io/badge/Lifecycle-Maturing-007EC6)](https://github.com/bcgov/repomountie/blob/master/doc/lifecycle-badges.md)
# About My Range Application (MyRA) API

The Range Mobile Pathfinder project is developing a suite of applications to support the sustainable management of rangelands in British Columbia. [Learn more about the Range Program](https://www.for.gov.bc.ca/hra/)

## Goals/Roadmap

The goal is to move important crown land management documents from paper to digital, and to make this information accessible in the field through disconnected mobile devices. This also supports a new and consistent process for Range staff across the province to support decision making processes.

### Related MyRA Documentation

- [MyRA iOS application Github Repository](https://github.com/bcgov/range-ios) (Deprecated by range-web)
- [MyRA Web application Github Repository](https://github.com/bcgov/range-web)
- [MyRa API Github Repository](https://github.com/bcgov/range-api)
- [Our current Sprint Backlog is visible on Github issues checkout the range-web and range-api repos to see what's going on]
- [See the database Schema on Schema-Spy](http://schema-spy-range-myra-dev.pathfinder.gov.bc.ca/)

## Usage

### Environment variables

Before being able to run the API and/or tests, you need to setup some environment variables. Copy and paste this into a `.env` file:
```
POSTGRESQL_DATABASE=myra
POSTGRESQL_DATABASE_TEST=myra_test
POSTGRESQL_HOST=db
POSTGRESQL_PORT=5432

PROJECT=myra_range
ENVIRONMENT=development
API_PORT=8080
BUILD_TARGET=base

POSTGRESQL_PASSWORD=banana
POSTGRESQL_USER=app_dv_myra

SSO_URL=https://sso-dev.pathfinder.gov.bc.ca/auth/realms/range/protocol/openid-connect
```

**Note that these environment variables _must_ be available in your shell. You can use a tool like `direnv`, or run `source .env` directly.**

> If using `direnv`, create a `.envrc` file containing `dotenv` to automatically load the environment variables into your shell. (https://github.com/direnv/direnv/issues/284#issuecomment-315275436)

#### Windows

If you find yourself on a Windows machine and can't get docker to play nice with WSL or otherwise need to get it rolling on Windows, throw this in .env.ps1, and after installing Make for Windows the below commands will still work, just make sure to run `powershell .env.ps1` first.  If you don't have a policy set yet to run powershell scripts (it is disabled by default) first run `Set-ExecutionPolicy -ExecutionPolicy Unrestricted -Scope CurrentUser` or just set one for the process, that is up to you.

```
$env:POSTGRESQL_DATABASE = "myra"
$env:POSTGRESQL_DATABASE_TEST = "myra_test"
$env:POSTGRESQL_HOST = "db"
$env:POSTGRESQL_PORT = "5432"

$env:PROJECT = "myra_range"
$env:ENVIRONMENT = "development"
$env:API_PORT = "8080"
$env:BUILD_TARGET = "base"

$env:POSTGRESQL_PASSWORD = "banana"
$env:POSTGRESQL_USER = "app_dv_myra"

$env:SSO_URL=https://sso-dev.pathfinder.gov.bc.ca/auth/realms/range/protocol/openid-connect
```

### Running the API locally

1. Build containers and seed database:
    ```
    make local-setup
    ```

2. Run API:
    ```
    make run-local
    ```

3. API will be available at http://localhost:8080/api

### Setting up users

First, make sure you have both the API and frontend running (https://github.com/bcgov/range-web for more info). As well, the user you're logging in as must have the correct role in SSO.

To access the database with `psql`, run `make database`.

The steps to get your user ready for the various roles are each a little different. Before doing any of them, you must have first signed in to create an associated row for your user in the database, and know the ID of that record.

#### Range Officer

In `ref_zone`, set the `user_id` of any of the seeded `TEST*` zones to your user's ID. You can also assign yourself to all of the `TEST*` zones for convenience. By default there are 6 test zones seeded.

```sql
UPDATE ref_zone
SET user_id=<user-id>
WHERE code='TEST1'; -- Or `WHERE code LIKE 'TEST%'` to assign to all test zones
```

#### Agreement Holder

> 💡(There are existing BCeID users that are already set up as agreement holders, if you know the credentials.)

Agreement holder's are a little bit more complicated. You have to create a `user_client_link` row that associates your `user_account` with one of the records in `ref_client`. The client you're linking to should exist in `ref_client`. Also keep in mind there may already be an existing link for a given `ref_client`. Feel free to delete it if you are getting a duplicate key error.

```sql
INSERT INTO user_client_link (client_id, user_id, active)
SELECT ref_client.id, <your-user-id>, true
FROM ref_client
WHERE ref_client.name = 'Tom Haverford'; 
```

> There are a few pre-seeded client records named after various P&R characters. The only differences between them is that some are setup with multi-AH agreements, while others are single.  For example, Ann Perkins shares agreements with Ron Swanson, while April Ludgate is the only agreement holder on her RANs.
> To see all client names:
> 
> ```sql
> SELECT name FROM ref_client;
> ```

#### Decision Maker

Decision maker's are assigned to whole districts. All of the test zones are in the same district, so in `ref_district` you can set the `user_id` of the `TST` district to your user's ID.

```sql
UPDATE ref_district
SET user_id=<user-id>
WHERE code='TST';
```

### Running tests

In general, there are two separate docker-compose projects that allow for isolation of the development and test environments. The development environment is the default project, and can be managed as usual through `docker-compose`. In order to run commands against the test project, you must add the `-p` flag to specify you want to use the `myra-test` project: `docker-compose -p myra-test`.

#### How to run tests:

1. Setup the test environment (ie. building images and seeding the database. This step doesn't have to be run every time): 
    ```
    make local-test-setup
    ```

2. Make sure test database is running (This step only has to be run if the test database is not already running):
    ```
    docker-compose -f test.docker-compose.yml -p myra-test up -d db
    ```

3. Run tests: 
    ```
    docker-compose -f test.docker-compose.yml -p myra-test run --rm range_api npm run test
    ```
    (or `npm run test:watch`)

This way, tests run inside of a docker container, allowing for reproducability, but also still let you interact with Jest's watch mode.

## How to Contribute

*If you are including a Code of Conduct, make sure that you have a [CODE_OF_CONDUCT.md](SAMPLE-CODE_OF_CONDUCT.md) file, and include the following text in here in the README:*
"Please note that this project is released with a [Contributor Code of Conduct](CODE_OF_CONDUCT.md). By participating in this project you agree to abide by its terms."

## License

Detailed guidance around licenses is available 
[here](/BC-Open-Source-Development-Employee-Guide/Licenses.md)

Attach the appropriate LICENSE file directly into your repository before you do anything else!

The default license For code repositories is: Apache 2.0

Here is the boiler-plate you should put into the comments header of every source code file as well as the bottom of your README.md:

    Copyright 2015 Province of British Columbia

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at 

       http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
   
For repos that are made up of docs, wikis and non-code stuff it's Creative Commons Attribution 4.0 International, and should look like this at the bottom of your README.md:

<a rel="license" href="http://creativecommons.org/licenses/by/4.0/"><img alt="Creative Commons Licence" style="border-width:0" src="https://i.creativecommons.org/l/by/4.0/80x15.png" /></a><br /><span xmlns:dct="http://purl.org/dc/terms/" property="dct:title">YOUR REPO NAME HERE</span> by <span xmlns:cc="http://creativecommons.org/ns#" property="cc:attributionName">the Province of Britich Columbia</span> is licensed under a <a rel="license" href="http://creativecommons.org/licenses/by/4.0/">Creative Commons Attribution 4.0 International License</a>.

and the code for the cc 4.0 footer looks like this:

    <a rel="license" href="http://creativecommons.org/licenses/by/4.0/"><img alt="Creative Commons Licence"
    style="border-width:0" src="https://i.creativecommons.org/l/by/4.0/80x15.png" /></a><br /><span
    xmlns:dct="http://purl.org/dc/terms/" property="dct:title">YOUR REPO NAME HERE</span> by <span
    xmlns:cc="http://creativecommons.org/ns#" property="cc:attributionName">the Province of Britich Columbia
    </span> is licensed under a <a rel="license" href="http://creativecommons.org/licenses/by/4.0/">
    Creative Commons Attribution 4.0 International License</a>.
