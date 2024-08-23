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
// Created by Jason Leach on 2018-05-10.
//

'use strict';

import LivestockIdentifierLocation from './livestockidentifierlocation';
import LivestockIdentifierType from './livestockidentifiertype';
import Model from './model';

export default class LivestockIdentifier extends Model {
  constructor(data, db = undefined) {
    const obj = {};
    Object.keys(data).forEach((key) => {
      if (LivestockIdentifier.fields.indexOf(`${LivestockIdentifier.table}.${key}`) > -1) {
        obj[key] = data[key];
      }
    });

    super(obj, db);

    this.location = new LivestockIdentifierLocation(LivestockIdentifierLocation.extract(data));
    this.identifierType = new LivestockIdentifierType(LivestockIdentifierType.extract(data));
  }

  static get fields() {
    // primary key *must* be first!
    return ['id', 'image_ref', 'description', 'accepted'].map((field) => `${this.table}.${field}`);
  }

  static get table() {
    return 'livestock_identifier';
  }

  static async findWithTypeLocation(db, where) {
    const myFields = [
      ...LivestockIdentifier.fields,
      ...LivestockIdentifierType.fields.map((f) => `${f} AS ${f.replace('.', '_')}`),
      ...LivestockIdentifierLocation.fields.map((f) => `${f} AS ${f.replace('.', '_')}`),
    ];

    const results = await db
      .select(myFields)
      .from(LivestockIdentifier.table)
      .join('ref_livestock_identifier_location', {
        'livestock_identifier.livestock_identifier_location_id': 'ref_livestock_identifier_location.id',
      })
      .join('ref_livestock_identifier_type', {
        'livestock_identifier.livestock_identifier_type_id': 'ref_livestock_identifier_type.id',
      })
      .where(where);

    return results.map((row) => new LivestockIdentifier(row, db));
  }
}
