import KyselyModel from './KyselyModel.js';

export default class LivestockType extends KyselyModel {
  static get fields(): string[] {
    return ['id', 'name', 'au_factor', 'active'];
  }

  static get table(): string {
    return 'ref_livestock';
  }

  static async getAllActive(_db: any) {
    const results = await this.find(_db, { active: true });
    return results.sort((a: any, b: any) => a.id - b.id);
  }
}
