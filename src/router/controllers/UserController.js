import { errorWithCode } from '@bcgov/nodejs-common-utils';
import { checkRequiredFields } from '../../libs/utils';
import DataManager from '../../libs/db2';
// import { checkRequiredFields } from '../../libs/utils';
import config from '../../config';

const dm = new DataManager(config);
const {
  db,
  User,
  Client,
} = dm;

class UserController {
  // Fetching all users
  async allUser(req, res) {
    try {
      const { user } = req;

      if (user && user.isAgreementHolder()) {
        throw errorWithCode('You do not have the permission as an agreement holder', 403);
      }

      const users = await User.find(db, {});

      res.status(200).json(users).end();
      return;
    } catch (error) {
      throw error;
    }
  }

  async me(req, res) {
    try {
      const { user } = req;
      delete user.created_at;
      delete user.updated_at;

      if (!user.piaSeen) {
        await User.update(db, { id: user.id }, { pia_seen: true });
      }

      res.status(200).json(user).end();
    } catch (error) {
      throw error;
    }
  }

  async updateMe(req, res) {
    try {
      const { body, user } = req;
      const { id: userId } = user;
      const {
        givenName,
        familyName,
        phoneNumber,
      } = body;

      const updated = await User.update(db, { id: userId }, {
        givenName,
        familyName,
        phoneNumber,
      });

      res.status(200).json(updated).end();
    } catch (error) {
      throw error;
    }
  }

  async assignClientId(req, res) {
    try {
      const { user, params } = req;
      const { clientId, userId } = params;

      checkRequiredFields(
        ['clientId', 'userId'], 'params', req,
      );

      if (user && user.isAgreementHolder()) {
        throw errorWithCode('You do not have the permission as an agreement holder', 403);
      }

      const client = await Client.find(db, { client_number: clientId });
      if (!client) {
        throw errorWithCode('Client does not exist', 400);
      }

      const result = await User.update(db, { id: userId }, {
        client_id: clientId,
        active: true,
      });

      res.status(200).json(result).end();
    } catch (error) {
      throw error;
    }
  }
}

const userController = new UserController();


export default userController;
