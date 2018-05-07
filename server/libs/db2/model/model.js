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
// Created by Jason Leach on 2018-05-07.
//

/* eslint-env es6 */

'use strict';

export default class Model {
  constructor(data) {
    const obj = {};
    Object.keys(data).forEach((key) => {
      obj[Model.toCamelCase(key)] = data[key];
    });
    Object.assign(this, obj);
  }

  static toCamelCase(str) {
    return str.replace(/_/g, ' ').replace(/(?:^\w|[A-Z]|\b\w)/g, (letter, index) => { // eslint-disable-line arrow-body-style
      return index === 0 ? letter.toLowerCase() : letter.toUpperCase();
    }).replace(/\s+/g, '');
  }

  static toSnakeCase(str) {
    return str.replace(/([A-Z])/g, $1 => `_${$1.toLowerCase()}`);
  }

  static extract(data, model) {
    const obj = {};
    Object.keys(data).forEach((key) => {
      const prefix = model.table;
      if (key.startsWith(prefix)) {
        const aKey = key.replace(prefix, '').slice(1);
        obj[aKey] = data[key];
      }
    });

    return obj;
  }
}
