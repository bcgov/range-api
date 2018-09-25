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

export default class AmendmentConfirmation extends Model {
  constructor(data, db = undefined) {
    const obj = {};
    Object.keys(data).forEach((key) => {
      if (AmendmentConfirmation.fields.indexOf(`${AmendmentConfirmation.table}.${key}`) > -1) {
        obj[key] = data[key];
      }
    });

    super(obj, db);
  }

  static get fields() {
    return ['id', 'plan_id', 'client_id', 'confirmed', 'created_at', 'updated_at'];
  }

  static get table() {
    return 'amendment_confirmation';
  }

  static async createConfirmations(db, agreementId, planId) {
    const agreement = await Agreement.findOne(db, { forest_file_id: agreementId });
    await agreement.fetchClients();

    const promises = agreement.clients.map(client => (
      AmendmentConfirmation.create(db, {
        plan_id: planId,
        client_id: client.id,
        confirmed: false,
      })
    ));
    const records = await Promise.all(promises);
    return records;
  }

  static async refreshAmendmentConfirmations(db, planId, user) {
    const confirmations = await AmendmentConfirmation.find(
      db, { plan_id: planId },
    );
    const promises = confirmations.map((c) => {
      const confirmed = c.clientId === user.clientId;
      return AmendmentConfirmation.update(db, { id: c.id }, { confirmed });
    });

    const records = await Promise.all(promises);
    return records;
  }
}
