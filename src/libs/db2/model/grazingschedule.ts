import { calcCrownAUMs, calcDateDiff, calcPldAUMs, calcTotalAUMs, round } from '../../../router/helpers/PDFHelper.js';
import { db as kyselyDb } from '../kysely.js';
import KyselyModel from './KyselyModel.js';
import GrazingScheduleEntry from './grazingscheduleentry.js';
import HayCuttingScheduleEntry from './haycuttingscheduleentry.js';

export default class Schedule extends KyselyModel {
  declare id: number;
  declare year: number;
  declare narative: string;
  declare planId: number;
  declare canonicalId: number;
  declare sortBy: string;
  declare sortOrder: string;
  declare createdAt: string;
  declare scheduleEntries: any[];
  static get fields(): string[] {
    return ['id', 'year', 'narative', 'plan_id', 'canonical_id', 'sort_by', 'sort_order', 'created_at'];
  }

  static get table(): string {
    return 'grazing_schedule';
  }

  static get primaryKey(): string {
    return 'id';
  }

  static scheduleEntryCreators: Record<number, any> = {
    1: GrazingScheduleEntry,
    2: GrazingScheduleEntry,
    3: HayCuttingScheduleEntry,
    4: HayCuttingScheduleEntry,
  };

  async fetchHayCuttingScheduleEntries(_db?: any) {
    const db = _db || kyselyDb;
    let order: any;
    let orderRaw = false;
    if (this.sortBy === 'days') {
      order = `date_out - date_in ${this.sortOrder ? this.sortOrder : 'asc'}`;
      orderRaw = true;
    } else {
      order = this.sortBy && this.sortOrder ? [this.sortBy.replace('.', '_'), this.sortOrder] : undefined;
    }
    const where = { haycutting_schedule_id: this.id };
    this.scheduleEntries = await HayCuttingScheduleEntry.findWithOrder(db, where, order, orderRaw);
    this.scheduleEntries = this.scheduleEntries.map(
      (entry: any) =>
        new HayCuttingScheduleEntry(
          {
            ...entry,
            dateIn: entry.dateIn ? new Date(entry.dateIn).toISOString().split('T')[0] : null,
            dateOut: entry.dateOut ? new Date(entry.dateOut).toISOString().split('T')[0] : null,
          },
          db,
        ),
    );
  }

  async fetchGrazingSchedulesEntries(_db?: any) {
    const db = _db || kyselyDb;
    let order: any;
    let orderRaw = false;
    if (this.sortBy !== 'pld_au_ms' && this.sortBy !== 'crown_au_ms') {
      if (this.sortBy === 'days') {
        order = `date_out - date_in ${this.sortOrder ? this.sortOrder : 'asc'}`;
        orderRaw = true;
      } else {
        order =
          this.sortBy && this.sortOrder
            ? [this.sortBy.replace('livestock_type', 'ref_livestock').replace('.', '_'), this.sortOrder]
            : undefined;
      }
    }
    const where = { grazing_schedule_id: this.id };
    let entries = await GrazingScheduleEntry.findWithLivestockType(db, where, order, orderRaw);
    if (this.sortBy === 'pld_au_ms' || this.sortBy === 'crown_au_ms') {
      entries = entries.map((row: any) => {
        const days = calcDateDiff(row.date_out, row.date_in, false);
        const pldPercent = row.pasture_pld_percent;
        const auFactor = row.ref_livestock_au_factor;
        const livestockCount = row.livestock_count;
        const totalAUMs = calcTotalAUMs(livestockCount, Number(days), Number(auFactor));
        row.pldAUMs = round(calcPldAUMs(totalAUMs, pldPercent), 0);
        const crownAUMWithDecimal = calcCrownAUMs(totalAUMs, row.pldAUMs);
        row.crownAUMs = crownAUMWithDecimal > 0 && crownAUMWithDecimal < 1 ? 1 : round(crownAUMWithDecimal, 0);
        row.dateIn = row.dateIn ? new Date(row.dateIn).toISOString().split('T')[0] : null;
        row.dateOut = row.dateOut ? new Date(row.dateOut).toISOString().split('T')[0] : null;
        return row;
      });
      if (this.sortBy === 'pld_au_ms') {
        if (this.sortOrder === 'asc') entries.sort((a: any, b: any) => a.pldAUMs - b.pldAUMs);
        else entries.sort((a: any, b: any) => b.pldAUMs - a.pldAUMs);
      } else {
        if (this.sortOrder === 'asc') entries.sort((a: any, b: any) => a.crownAUMs - b.crownAUMs);
        else entries.sort((a: any, b: any) => b.crownAUMs - a.crownAUMs);
      }
    }
    this.scheduleEntries = entries.map((entry: any) => new GrazingScheduleEntry(entry, db));
  }
}
