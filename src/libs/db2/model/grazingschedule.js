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

"use strict";

import {
  calcCrownAUMs,
  calcDateDiff,
  calcPldAUMs,
  calcTotalAUMs,
  roundToSingleDecimalPlace,
} from "../../../router/helpers/PDFHelper";
import GrazingScheduleEntry from "./grazingscheduleentry";
import Model from "./model";

export default class GrazingSchedule extends Model {
  static get fields() {
    // primary key *must* be first!
    return [
      "id",
      "year",
      "narative",
      "plan_id",
      "canonical_id",
      "sort_by",
      "sort_order",
      "created_at",
    ].map((field) => `${this.table}.${field}`);
  }

  static get table() {
    return "grazing_schedule";
  }

  // eslint-disable-next-line class-methods-use-this
  async fetchGrazingSchedulesEntries() {
    let order;
    let orderRaw = false;

    if (this.sortBy !== "pld_au_ms" && this.sortBy !== "crown_au_ms") {
      if (this.sortBy === "days") {
        order = `date_out - date_in ${this.sortOrder ? this.sortOrder : "asc"}`;
        orderRaw = true;
      } else {
        order =
          this.sortBy && this.sortOrder
            ? [
                this.sortBy
                  .replace("livestock_type", "ref_livestock")
                  .replace(".", "_"),
                this.sortOrder,
              ]
            : undefined;
      }
    }
    const where = { grazing_schedule_id: this.id };
    let entries = await GrazingScheduleEntry.findWithLivestockType(
      this.db,
      where,
      order,
      orderRaw,
    );
    if (this.sortBy === "pld_au_ms" || this.sortBy === "crown_au_ms") {
      entries = entries.map((row) => {
        const days = calcDateDiff(row.date_out, row.date_in, false);
        const pldPercent = row.pasture_pld_percent;
        const auFactor = row.ref_livestock_au_factor;
        const livestockCount = row.livestock_count;
        const totalAUMs = calcTotalAUMs(livestockCount, days, auFactor);
        row.pldAUMs = roundToSingleDecimalPlace(
          calcPldAUMs(totalAUMs, pldPercent),
        );
        row.crownAUMs = roundToSingleDecimalPlace(
          calcCrownAUMs(totalAUMs, row.pldAUMs),
        );
        return row;
      });
      if (this.sortBy === "pld_au_ms") {
        if (this.sortOrder === "asc")
          entries.sort((a, b) => a.pldAUMs - b.pldAUMs);
        else entries.sort((a, b) => b.pldAUMs - a.pldAUMs);
      } else {
        if (this.sortOrder === "asc")
          entries.sort((a, b) => a.crownAUMs - b.crownAUMs);
        else entries.sort((a, b) => b.crownAUMs - a.crownAUMs);
      }
    }
    this.grazingScheduleEntries = entries.map(
      (entry) => new GrazingScheduleEntry(entry, this.db),
    );
  }
}
