// @ts-nocheck
'use strict';

import { dayjs as moment } from '../../libs/bcgov-shim.js';
import { AGREEMENT_EXEMPTION_STATUS, EXEMPTION_STATUS, SSO_ROLE_MAP } from '../../constants.js';
import DataManager from '../../libs/db2/index.js';
import config from '../../config/index.js';
import NotificationHelper from './NotificationHelper.js';

const dm = new DataManager(config);
const { Agreement, Plan } = dm;

export const updateAgreementExemptions = async (trx, user, agreementId = null) => {
  // Use dynamic import to avoid circular dependency
  const { default: ExemptionStatusController } = await import('../controllers_v1/ExemptionStatusController.js');

  const today = moment().startOf('day'); // Use startOf('day') for accurate comparison

  let query = trx
    .selectFrom('exemption')
    .selectAll()
    .where('status', '=', EXEMPTION_STATUS.APPROVED)
    .orderBy('agreement_id')
    .orderBy('start_date', 'asc');

  if (agreementId) {
    query = query.where('agreement_id', '=', agreementId);
  }

  const allApprovedExemptions = await query.execute();
  const agreementExemptionStatusUpdates = {}; // To store the determined status for each agreement

  if (agreementId) {
    // Initialize status for agreement if not already present, default to NOT_EXEMPTED
    agreementExemptionStatusUpdates[agreementId] = AGREEMENT_EXEMPTION_STATUS.NOT_EXEMPTED;
  }

  for (const exemption of allApprovedExemptions) {
    const currentAgreementId = exemption.agreement_id;
    const exemptionStartDate = moment(exemption.start_date).startOf('day');
    const exemptionEndDate = moment(exemption.end_date).startOf('day');

    const activePlanForAgreement = await trx
      .selectFrom('plan')
      .selectAll()
      .where('agreement_id', '=', currentAgreementId)
      .where('status_id', 'in', Plan.legalStatuses) // Use Plan.legalStatuses
      .where('plan_end_date', '>', today.toDate())
      .executeTakeFirst();

    // If an active plan exists and this exemption is scheduled to start today
    // OR if the exemption has already ended
    if ((activePlanForAgreement && exemptionStartDate.isSame(today)) || exemptionEndDate.isBefore(today)) {
      if (exemption.status !== EXEMPTION_STATUS.CANCELLED) {
        const reason = exemptionEndDate.isBefore(today)
          ? 'Exemption cancelled because its end date has passed.'
          : 'Exemption cancelled due to existing active plan.';
        await ExemptionStatusController.performExemptionTransition(
          trx,
          exemption.id,
          EXEMPTION_STATUS.CANCELLED,
          reason,
          user, // Pass systemUser
          currentAgreementId,
          exemption,
          [SSO_ROLE_MAP.DECISION_MAKER], // Exclude district managers from notifications for this cancellation
        );
      }
      continue; // Skip to next exemption
    }

    // Initialize status for agreement if not already present, default to NOT_EXEMPTED
    if (!(currentAgreementId in agreementExemptionStatusUpdates)) {
      agreementExemptionStatusUpdates[currentAgreementId] = AGREEMENT_EXEMPTION_STATUS.NOT_EXEMPTED;
    }

    const currentDeterminedStatus = agreementExemptionStatusUpdates[currentAgreementId];
    if (today.isBetween(exemptionStartDate, exemptionEndDate, null, '[]')) {
      // Exemption is active today
      agreementExemptionStatusUpdates[currentAgreementId] = AGREEMENT_EXEMPTION_STATUS.EXEMPTED;
    } else if (
      exemptionStartDate.isAfter(today) &&
      currentDeterminedStatus === AGREEMENT_EXEMPTION_STATUS.NOT_EXEMPTED
    ) {
      // Exemption is in the future AND current determined status is NOT_EXEMPTED
      // This means no active exemption has been found yet for this agreement and no other future exemption made it SCHEDULED
      agreementExemptionStatusUpdates[currentAgreementId] = AGREEMENT_EXEMPTION_STATUS.SCHEDULED;
    }
    // If exemption is in the past (exemptionEndDate.isBefore(today)), it doesn't change the status unless no other
    // future or active exemption exists, which is handled by the initial default.
    // If an exemption is active or scheduled, a past exemption shouldn't override that.
    // We prioritize ACTIVE > SCHEDULED > NOT_EXEMPTED
  }

  // Now, apply the determined status to each agreement and return updates
  const agreementIdsToUpdate = agreementId ? [agreementId] : Object.keys(agreementExemptionStatusUpdates);
  const updatedAgreements = [];

  for (const aid of agreementIdsToUpdate) {
    // Safety check if we are in global mode to ensure we have a status to update
    if (!agreementId && !agreementExemptionStatusUpdates[aid]) continue;

    const determinedStatus = agreementExemptionStatusUpdates[aid] || AGREEMENT_EXEMPTION_STATUS.NOT_EXEMPTED;
    const [currentAgreement] = await Agreement.find(trx, { forest_file_id: aid });

    if (currentAgreement && currentAgreement.exemptionStatus !== determinedStatus) {
      await Agreement.update(trx, { forest_file_id: aid }, { exemption_status: determinedStatus });
      updatedAgreements.push({
        agreementId: aid,
        status: determinedStatus,
      });
    }
  }

  return updatedAgreements;
};

export const sendAgreementExemptionStatusEmails = async (trx, updatedAgreements) => {
  for (const { agreementId, status } of updatedAgreements) {
    const { emails } = await NotificationHelper.getParticipants(trx, agreementId);
    if (emails.length > 0) {
      await NotificationHelper.sendEmail(trx, emails, 'Agreement Exemption Status Change', {
        '{agreement_id}': agreementId,
        '{new_status}': Agreement.getExemptionStatusText(status),
      });
    }
  }
};
