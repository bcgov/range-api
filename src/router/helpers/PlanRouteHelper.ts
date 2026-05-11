// @ts-nocheck
import { errorWithCode } from '../../libs/bcgov-shim.js';

class PlanRouteHelper {
  static async canUserAccessThisAgreement(db, Agreement, user, agreementId) {
    if (!agreementId) {
      throw errorWithCode('Unable to find a plan');
    }

    const [agreement] = await Agreement.find(db, {
      forest_file_id: agreementId,
    });
    if (!agreement) {
      throw errorWithCode('Unable to find the related agreement');
    }

    const can = await user.canAccessAgreement(db, agreement);
    if (!can) {
      throw errorWithCode('You do not access to this agreement', 403);
    }
  }
}
export default PlanRouteHelper;
