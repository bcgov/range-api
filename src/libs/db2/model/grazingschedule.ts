import { calculateEntryAUMs } from '../../aumCalculation.js';
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
    this.scheduleEntries = this.scheduleEntries.map((entry: any) => {
      const formatted = { ...entry };
      formatted.date_in = formatted.date_in ? new Date(formatted.date_in).toISOString().split('T')[0] : null;
      formatted.date_out = formatted.date_out ? new Date(formatted.date_out).toISOString().split('T')[0] : null;
      return new HayCuttingScheduleEntry(formatted, db);
    });
  }

  async fetchGrazingSchedulesEntries(_db?: any) {
    const db = _db || kyselyDb;
    let order: any;
    let orderRaw = false;
    if (this.sortBy !== 'pld_aums' && this.sortBy !== 'crown_aums') {
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
    if (this.sortBy === 'pld_aums' || this.sortBy === 'crown_aums') {
      entries = entries.map((row: any) => {
        const { pldAUMs, crownAUMs } = calculateEntryAUMs(row);
        row.pldAUMs = pldAUMs;
        row.crownAUMs = crownAUMs;
        return row;
      });
      if (this.sortBy === 'pld_aums') {
        if (this.sortOrder === 'asc') entries.sort((a: any, b: any) => a.pldAUMs - b.pldAUMs);
        else entries.sort((a: any, b: any) => b.pldAUMs - a.pldAUMs);
      } else {
        if (this.sortOrder === 'asc') entries.sort((a: any, b: any) => a.crownAUMs - b.crownAUMs);
        else entries.sort((a: any, b: any) => b.crownAUMs - a.crownAUMs);
      }
    }
    this.scheduleEntries = entries.map((entry: any) => {
      const formatted = { ...entry };
      formatted.date_in = formatted.date_in ? new Date(formatted.date_in).toISOString().split('T')[0] : null;
      formatted.date_out = formatted.date_out ? new Date(formatted.date_out).toISOString().split('T')[0] : null;
      return new GrazingScheduleEntry(formatted, db);
    });
  }
}
