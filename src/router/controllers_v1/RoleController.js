import DataManager from '../../libs/db2';
import config from '../../config';

const dm = new DataManager(config);
const {
  db,
  Role,
} = dm;

export class RoleController {
  // Fetching all roles
  static async allRoles(req, res) {
    try {
      const roles = await Role.getRoles(db);

      res.status(200).json(roles).end();
      return;
    } catch (error) {
      throw error;
    }
  }

  
}

const roleController = new RoleController();

export default roleController;
