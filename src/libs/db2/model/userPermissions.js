import Model from './model';

export default class UserPermissions extends Model {
  constructor(data, db = undefined) {
    const obj = {};
    Object.keys(data).forEach((key) => {
      if (UserPermissions.fields.indexOf(`${UserPermissions.table}.${key}`) > -1) {
        obj[key] = data[key];
      }
    });

    super(obj, db);
  }

  static get fields() {
    // primary key *must* be first!
    return ['id', 'role_id', 'permission_id'].map((f) => `${UserPermissions.table}.${f}`);
  }

  static get table() {
    return 'role_permissions';
  }

  static async getRolePermissions(db, roleId) {
    const [...result] = await db
      .table('role_permissions')
      .join('permissions', { 'permissions.id': 'role_permissions.permission_id' })
      .where({
        'role_permissions.role_id': roleId,
      });

    return result.map((permission) => {
      return {
        id: permission.permission_id,
        description: permission.description,
      };
    });
  }

  static async getRoles(db) {
    const [...result] = await db.table('roles');

    return result.map((role) => {
      return {
        id: role.id,
        description: role.description,
      };
    });
  }
}
