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
  ActiveClientAccount,
} = dm;

export class UserController {
  // Fetching all users
  static async allUser(req, res) {
    try {
      const { user, query } = req;
      const { orderCId, excludeBy: eBy, exclude: e } = query;

      if (user && user.isAgreementHolder()) {
        throw errorWithCode('You do not have the permission as an agreement holder', 403);
      }

      let order;
      if (orderCId) {
        order = ['client_id', orderCId];
      }

      let exclude;
      if (eBy && e) {
        exclude = [eBy, 'ilike', `%${e}%`];
      }

      const users = await User.findWithExclusion(db, {}, order, exclude);

      res.status(200).json(users).end();
      return;
    } catch (error) {
      throw error;
    }
  }

  static async me(req, res) {
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

  static async updateMe(req, res) {
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

  static async addClientLink(req, res) {
    const { user, params } = req;
    const { clientId, userId } = params;

    if (user && user.isAgreementHolder()) {
      throw errorWithCode('Unauthorized', 403);
    }

    checkRequiredFields(
      ['clientId', 'userId'], 'params', req,
    );

    const client = await Client.find(db, { client_number: clientId });
    if (!client) {
      throw errorWithCode('Client does not exist', 400);
    }

    const result = await ActiveClientAccount.create(db, {
      client_id: clientId,
      user_id: userId,
      active: true,
      type: 'owner',
    });

    res.status(200).json(result).end();
  }

  static async removeClientLink(req, res) {
    const { user, params } = req;
    const { clientId, userId } = params;

    if (user && user.isAgreementHolder()) {
      throw errorWithCode('Unauthorized', 403);
    }

    checkRequiredFields(
      ['clientId', 'userId'], 'params', req,
    );

    const result = await ActiveClientAccount.remove(db, {
      client_id: clientId,
      user_id: userId,
    });

    if (result === 0) {
      throw errorWithCode("Client link doesn't exist for user", 404);
    }

    res.status(200).json(result).end();
  }
}

const userController = new UserController();


export default userController;
