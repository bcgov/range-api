//
// MyRA
//
// Copyright © 2018 Province of British Columbia
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// Created by Kyubin Han
//

import Model from './model';
import Agreement from './agreement';

export default class PlanConfirmation extends Model {
  constructor(data, db = undefined) {
    const obj = {};
    Object.keys(data).forEach((key) => {
      if (
        PlanConfirmation.fields.indexOf(`${PlanConfirmation.table}.${key}`) > -1
      ) {
        obj[key] = data[key];
      }
    });

    super(obj, db);
  }

  static get fields() {
    return [
      'id',
      'plan_id',
      'client_id',
      'confirmed',
      'created_at',
      'updated_at',
      'user_id',
      'is_own_signature',
      'is_manual_confirmation',
    ];
  }

  static get table() {
    return 'plan_confirmation';
  }

  static async createConfirmations(db, agreementId, planId) {
    const agreement = await Agreement.findOne(db, {
      forest_file_id: agreementId,
    });
    await agreement.fetchClients();

    const promises = agreement.clients.map((client) =>
      PlanConfirmation.create(db, {
        plan_id: planId,
        client_id: client.clientNumber,
        confirmed: false,
      }),
    );
    const records = await Promise.all(promises);
    return records;
  }

  static async refreshConfirmations(db, planId, user) {
    const confirmations = await PlanConfirmation.find(db, { plan_id: planId });

    // refresh all confirmations within the plan except the one who's requesting
    const promises = confirmations.map((c) => {
      const confirmed = c.clientId === user.clientId;
      return PlanConfirmation.update(db, { id: c.id }, { confirmed });
    });

    const records = await Promise.all(promises);
    return records;
  }
}
