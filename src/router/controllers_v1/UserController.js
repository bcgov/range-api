import { errorWithCode, logger } from '@bcgov/nodejs-common-utils';
import { checkRequiredFields } from '../../libs/utils';
import DataManager from '../../libs/db2';
import config from '../../config';

const dm = new DataManager(config);
const {
  db,
  User,
  Client,
  UserClientLink,
  ClientAgreement,
  UserFeedback,
  PlanStatusHistory,
  PlanConfirmation,
  District,
  Zone,
  Plan,
  PlanFile,
} = dm;

export class UserController {
  // Fetching all users
  static async allUser(req, res) {
    try {
      const { query } = req;
      const { orderCId, excludeBy: eBy, exclude: e } = query;

      let order = [];
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

      const clientIds = await user.getLinkedClientNumbers(db);

      const clients = await Client.find(db, { client_number: clientIds });

      res
        .status(200)
        .json({ ...user, clients })
        .end();
    } catch (error) {
      throw error;
    }
  }

  static async updateMe(req, res) {
    try {
      const { body, user } = req;
      const { id: userId } = user;
      const { givenName, familyName, phoneNumber } = body;

      const updated = await User.update(
        db,
        { id: userId },
        {
          givenName,
          familyName,
          phoneNumber,
        },
      );

      res.status(200).json(updated).end();
    } catch (error) {
      throw error;
    }
  }

  static async mergeAccounts(req, res) {
    const { params, body } = req;
    const { userId } = params;
    const sourceAccountIds = body.accountIds;
    checkRequiredFields(['userId'], 'params', req);

    checkRequiredFields(['accountIds'], 'body', req);

    const userRequest = await User.findOne(db, { id: userId });
    if (!userRequest) {
      throw errorWithCode('User does not exist', 400);
    }

    for (const id of sourceAccountIds) {
      const account = await User.findOne(db, { id: id });
      if (!account) {
        throw errorWithCode('Invalid accountId supplied', 400);
      }
    }
    for (const sourceUserId of sourceAccountIds) {
      UserFeedback.update(db, { user_id: sourceUserId }, { user_id: userId });
      UserClientLink.update(db, { user_id: sourceUserId }, { user_id: userId });
      ClientAgreement.update(
        db,
        { agent_id: sourceUserId },
        { agent_id: userId },
      );
      PlanStatusHistory.update(
        db,
        { user_id: sourceUserId },
        { user_id: userId },
      );
      PlanConfirmation.update(
        db,
        { user_id: sourceUserId },
        { user_id: userId },
      );
      District.update(db, { user_id: sourceUserId }, { user_id: userId });
      Zone.update(db, { user_id: sourceUserId }, { user_id: userId });
      Plan.update(db, { creator_id: sourceUserId }, { creator_id: userId });
      PlanFile.update(db, { user_id: sourceUserId }, { user_id: userId });
    }
    res.status(200).json().end();
  }

  static async addClientLink(req, res) {
    const { params, body } = req;
    const { userId } = params;
    const { clientId } = body;

    checkRequiredFields(['userId'], 'params', req);

    checkRequiredFields(['clientId'], 'body', req);

    const client = await Client.findOne(db, { client_number: clientId });
    if (!client) {
      throw errorWithCode('Client does not exist', 400);
    }

    const currentLink = await UserClientLink.findOne(db, {
      user_id: userId,
      client_id: clientId,
    });
    if (currentLink) {
      logger.error(
        `Link between user ${userId} and client ${clientId} already exists.`,
      );
      throw errorWithCode(
        'This user is already linked to the selected client',
        400,
      );
    }

    const currentOwner = await UserClientLink.findOne(db, {
      client_id: clientId,
      type: 'owner',
    });
    if (currentOwner) {
      const currentOwnerUser = await User.findById(db, currentOwner.userId);
      logger.error(
        `There is already a user (${currentOwner.userId}) linked to this client (${clientId}).`,
      );
      throw errorWithCode(
        `Cannot link client to this user because it is already linked to another user (${currentOwnerUser.givenName} ${currentOwnerUser.familyName}).`,
        400,
      );
    }

    const userToLink = new User({ id: userId });

    const currentLinkedClientIds = await userToLink.getLinkedClientNumbers(db);

    const currentLinkedAgreements = await ClientAgreement.find(db, {
      client_id: currentLinkedClientIds,
    });

    const newLinkedAgreements = await ClientAgreement.find(db, {
      client_id: clientId,
    });
    const newLinkedAgreementIds = newLinkedAgreements.map(
      (clientAgreement) => clientAgreement.agreementId,
    );

    // TODO: Remove this check after implementing agency agreements
    // eslint-disable-next-line no-restricted-syntax
    for (const clientAgreement of currentLinkedAgreements) {
      if (newLinkedAgreementIds.includes(clientAgreement.agreementId)) {
        // eslint-disable-next-line no-await-in-loop
        const existingClient = await Client.findById(
          db,
          clientAgreement.clientId,
        );

        logger.error(
          `Cannot link client ID ${clientId} with user ID ${userId} because it shares an agreement with client ID ${clientAgreement.clientId} (${clientAgreement.agreementId})`,
        );
        throw errorWithCode(
          `Cannot link selected client because it shares an agreement with client ${existingClient.name}, # ${existingClient.clientNumber} - ${existingClient.locationCode} (${clientAgreement.agreementId})`,
          400,
        );
      }
    }

    const result = await UserClientLink.create(db, {
      client_id: clientId,
      user_id: userId,
      active: true,
      type: 'owner',
    });

    res.status(200).json(result).end();
  }

  static async removeClientLink(req, res) {
    const { params } = req;
    const { clientNumber, userId } = params;

    checkRequiredFields(['clientNumber', 'userId'], 'params', req);

    const result = await UserClientLink.remove(db, {
      client_id: clientNumber,
      user_id: userId,
    });

    if (result === 0) {
      throw errorWithCode("Client link doesn't exist for user", 404);
    }

    res.status(200).json(result).end();
  }

  static async assignUserRole(req, res) {
    try {
      const { body, params } = req;
      const { userId: userId } = params;
      const roleId = body.roleId;

      const updated = await User.update(
        db,
        { id: userId },
        {
          roleId,
        },
      );

      res.status(200).json(updated).end();
    } catch (error) {
      throw error;
    }
  }

  static async assignUserDistrict(req, res) {
    try {
      const { body, params } = req;
      const { userId: userId } = params;
      const districtId = body.districtId;

      const updated = await District.update(
        db,
        { id: districtId },
        {
          userId,
        },
      );

      res.status(200).json(updated).end();
    } catch (error) {
      throw error;
    }
  }

  static async assignUserDistricts(req, res) {
    try {
      const { body, params } = req;
      const { userId: userId } = params;
      const districtIds = body.districtIds;

      // empty districts
      const deleted = await District.removeDistricts(
        db,
        {user_id: userId}
      );

      const updated = await District.updateMultiple(
        db,
        { ids: districtIds },
        {
          userId,
        },
      );

      res.status(200).json(updated).end();
    } catch (error) {
      throw error;
    }
  }

  static async show(req, res) {
    const { params } = req;
    const { userId } = params;

    const userToFind = await User.findById(db, userId);

    const clientIds = await userToFind.getLinkedClientNumbers(db);

    const clients = await Client.find(db, { client_number: clientIds });

    res
      .status(200)
      .json({ ...userToFind, clients })
      .end();
  }
}

const userController = new UserController();

export default userController;
