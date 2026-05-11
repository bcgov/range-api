import { db as kyselyDb } from '../kysely.js';
import KyselyModel from './KyselyModel.js';

export default class UserPermissions extends KyselyModel {
  static get fields(): string[] {
    return ['id', 'role_id', 'permission_id'];
  }

  static get table(): string {
    return 'role_permissions';
  }

  static async getRolePermissions(_db: any, roleId: number) {
    const db = _db || kyselyDb;
    const result = await db
      .selectFrom('role_permissions')
      .innerJoin('permissions', 'permissions.id', 'role_permissions.permission_id')
      .selectAll()
      .where('role_permissions.role_id', '=', roleId)
      .execute();

    return result.map((permission: Record<string, any>) => {
      return {
        id: permission.permission_id,
        description: permission.description,
      };
    });
  }

  static async getRoles(_db: any) {
    const db = _db || kyselyDb;
    const result = await db.selectFrom('roles').selectAll().execute();

    return result.map((role: Record<string, any>) => {
      return {
        id: role.id,
        description: role.description,
      };
    });
  }
}
