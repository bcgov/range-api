'use strict';

import { create } from 'lodash';
import config from '../src/config';
import DataManager from '../src/libs/db2';

const dm = new DataManager(config);

const {
  db,
  Plan,
  PlanExtensionRequests,
} = dm;


const main = async () => {
  try {
    // var args = process.argv.slice(2);
    const currentDate = new Date();
    const sixMonthsLater = new Date();
    sixMonthsLater.setMonth(currentDate.getMonth() + 6);
    const expiringPlans = await Plan.fetchExpiringPlanIds(db, currentDate, sixMonthsLater, null, 'plan.id');
    console.log(expiringPlans);
    for (const expiringPlan of expiringPlans) {
      try {
        await PlanExtensionRequests.create(db, {
          planId: expiringPlan.planId,
          clientId: expiringPlan.clientId,
          userId: expiringPlan.userId,
          email: expiringPlan.email,
        });
      } catch (error) {
        console.log(error)
        console.log(expiringPlan)
      }
    }
  } catch (err) {
    console.log(`Error importing data, message = ${err.message}`);
    process.exit(0);
    throw err;
  }
  process.exit(0);
};

main();