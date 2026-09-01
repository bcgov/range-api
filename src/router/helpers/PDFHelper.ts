// @ts-nocheck
import { dayjs as moment } from '../../libs/bcgov-shim.js';
import { NOT_PROVIDED } from '../../constants.js';
import Agreement from '../../libs/db2/model/agreement.js';
import { computeAUMs } from '../../libs/aumCalculation.js';

/**
 * The AUM maths lives in src/libs/aumCalculation.ts. It is re-exported here
 * because a number of modules (and tests) have imported it from this file
 * historically, and because it reads naturally alongside the PDF generation
 * that consumes it.
 */
export {
  round,
  calcTotalAUMs,
  calcDateDiff,
  calcPldAUMs,
  calcCrownAUMs,
  calcCrownTotalAUMs,
} from '../../libs/aumCalculation.js';

import { round } from '../../libs/aumCalculation.js';

export const formatPlanVersionDate = (date) =>
  date ? moment.utc(date).tz('America/Vancouver').format('YYYY-MM-DD') : date;

export const formatPlanVersionDates = (plan) => {
  if (plan.originalApproval) {
    plan.originalApproval.date = formatPlanVersionDate(plan.originalApproval.date);
  }

  if (plan.amendmentSubmissions) {
    plan.amendmentSubmissions.forEach((submission) => {
      submission.createdAt = formatPlanVersionDate(submission.createdAt);
      submission.approvedAt = formatPlanVersionDate(submission.approvedAt);
    });
  }

  return plan;
};

// Format percent use - round up with no decimal places
// If value is between 0 and 1 (exclusive), set to 1
// Otherwise, round up to nearest integer
export const roundUpPercentUse = (percentUse) => {
  if (percentUse === undefined || percentUse === null || isNaN(percentUse)) {
    return 0;
  }
  const value = parseFloat(percentUse);
  if (value > 0 && value < 1) {
    return 1;
  }
  return Math.ceil(value);
};

export class AdditionalDetailsGenerator {
  setDocumentGenerationDate(plan) {
    plan.currentDate = moment();
  }

  setClientConfirmationStatus(plan) {
    for (const client of plan.agreement.clients) {
      const confirmation = plan.confirmations.find((item) => item.clientId === client.id);
      client.confirmationStatus = 'Not Confirmed';
      if (confirmation && confirmation.confirmed === true) {
        client.confirmationStatus = 'Confirmed';
      }
    }
  }

  setPlantCommunityDetails(plan) {
    for (const pasture of plan.pastures) {
      if (pasture) {
        for (const pasture of plan.pastures) {
          if (!pasture.pldPercent || isNaN(pasture.pldPercent)) {
            pasture.pldPercent = 0;
          }
        }
        if (!pasture.notes) {
          pasture.notes = NOT_PROVIDED;
        }
        for (const plantCommunity of pasture.plantCommunities) {
          if (plantCommunity) {
            if (plantCommunity.rangeReadinessMonth && plantCommunity.rangeReadinessDay) {
              plantCommunity.rangeReadinessDate = moment()
                .set('month', plantCommunity.rangeReadinessMonth - 1)
                .set('date', plantCommunity.rangeReadinessDay)
                .format('MMMM D');
            }
            if (plantCommunity.plantCommunityActions) {
              for (const action of plantCommunity.plantCommunityActions) {
                if (action) {
                  action.name = action.actionType.name === 'Other' ? `${action.name} (Other)` : action.actionType.name;
                  if (action.actionType.name === 'Timing') {
                    action.NoGrazeStartDate =
                      action.noGrazeStartMonth && action.noGrazeStartDay
                        ? moment()
                            .set('month', action.noGrazeStartMonth - 1)
                            .set('date', action.noGrazeStartDay)
                            .format('MMMM Do')
                        : 'Not Provided';
                    action.NoGrazeEndDate =
                      action.noGrazeEndMonth && action.noGrazeEndDay
                        ? moment()
                            .set('month', action.noGrazeEndMonth - 1)
                            .set('date', action.noGrazeEndDay)
                            .format('MMMM Do')
                        : 'Not Provided';
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  setIndicatorPlantDetails(plan) {
    for (const pasture of plan.pastures) {
      if (pasture) {
        for (const plantCommunity of pasture.plantCommunities) {
          if (plantCommunity) {
            for (const indicatorPlant of plantCommunity.indicatorPlants) {
              indicatorPlant.name =
                indicatorPlant.plantSpecies.name === 'Other'
                  ? `${indicatorPlant.name} (Other)`
                  : indicatorPlant.plantSpecies.name;
            }
          }
        }
      }
    }
  }

  setScheduleDetails(plan) {
    for (const schedule of plan.schedules) {
      if (schedule) {
        schedule.crownTotalAUM = 0;
        // Check if this is a hay cutting schedule using helper function
        const isHayCutting = Agreement.isHayCuttingSchedule(plan.agreement);
        for (const entry of schedule.scheduleEntries) {
          if (entry) {
            const pasture = plan.pastures.find((item) => item.id === entry.pastureId);
            entry.pasture = 'N/A';
            if (pasture) {
              entry.pasture = pasture.name;
              if (Agreement.isGrazingSchedule(plan.agreement)) {
                entry.graceDays = entry.graceDays || pasture.graceDays;
              }
            }

            if (isHayCutting) {
              // Format dates for hay cutting schedules
              entry.dateInFormatted = entry.dateIn ? moment(entry.dateIn).format('MMM DD, YYYY') : 'N/A';
              entry.dateOutFormatted = entry.dateOut ? moment(entry.dateOut).format('MMM DD, YYYY') : 'N/A';

              // For hay cutting schedules, totalAUM is based on tonne values
              // No PLD (Private Land Deduction) calculations for hay cutting schedules
              entry.totalAUM = entry.tonnes || 0;
              delete entry.pldAUM; // No PLD for hay cutting schedules
              entry.crownAUM = entry.totalAUM; // Crown AUM equals total AUM for hay cutting
              schedule.crownTotalAUM += entry.crownAUM;
              entry.crownAUM = round(entry.crownAUM, 1);
            } else {
              // Process grazing schedule entries.
              //
              // `pasture.pldPercent` is read without a guard, matching the
              // long-standing behaviour: an entry pointing at a pasture the
              // plan does not contain throws here rather than falling back.
              // See PDFHelper.setScheduleDetails.spec.ts.
              entry.auFactor = entry.livestockType?.auFactor;

              const { days, totalAUMs, pldAUMs, crownAUMs } = computeAUMs({
                dateIn: entry.dateIn,
                dateOut: entry.dateOut,
                livestockCount: entry.livestockCount,
                auFactor: entry.auFactor,
                pldPercent: pasture.pldPercent,
              });

              // The docx template binds the SINGULAR names, unlike the DB model
              // and the CSV export which use the plural forms. Do not rename.
              entry.days = days;
              entry.totalAUM = totalAUMs;
              entry.pldAUM = pldAUMs;
              entry.crownAUM = crownAUMs;
              schedule.crownTotalAUM += entry.crownAUM;
            }
          }
        }

        // Calculate schedule totals and usage percentages for all schedule types
        if (plan.agreement.usage) {
          const usage = plan.agreement.usage.find((element) => element.year === schedule.year);
          if (usage) schedule.authorizedAUM = usage.totalAnnualUse;
          if (schedule.authorizedAUM) {
            schedule.percentUse = roundUpPercentUse((schedule.crownTotalAUM / schedule.authorizedAUM) * 100);
          }
        }
      }
    }
  }

  setMinisterIssuesPastureName(plan) {
    for (const issue of plan.ministerIssues) {
      if (issue) {
        issue.pastureNames = [];
        for (const pastureId of issue.pastures) {
          if (pastureId) {
            const pasture = plan.pastures.find((item) => item.id === pastureId);
            if (pasture) {
              issue.pastureNames.push({ pastureName: pasture.name });
            }
          }
        }
      }
    }
  }

  setInvasivePlantCheckListIsEmpty(plan) {
    plan.invasivePlantChecklist.isEmpty = !(
      plan.invasivePlantChecklist.beginInUninfestedArea ||
      plan.invasivePlantChecklist.equipmentAndVehiclesParking ||
      plan.invasivePlantChecklist.revegetate ||
      plan.invasivePlantChecklist.undercarrigesInspected ||
      plan.invasivePlantChecklist.other?.length > 0
    );
  }

  setStatusText(plan) {
    if (
      plan.status.id === 1 ||
      plan.status.id === 2 ||
      plan.status.id === 3 ||
      plan.status.id === 4 ||
      plan.status.id === 5 ||
      plan.status.id === 6 ||
      plan.status.id === 14 ||
      plan.status.id === 15 ||
      plan.status.id === 16 ||
      plan.status.id === 17 ||
      plan.status.id === 19 ||
      (plan.status.id === 13 && plan.amendmentTypeId === null) ||
      (plan.status.id === 18 && plan.amendmentTypeId === null)
    ) {
      plan.status.text = 'Draft';
    } else if (plan.status.id === 7) {
      plan.status.text = 'Not Approved - Amendment without effect';
    } else if (plan.status.id === 8) {
      plan.status.text = 'Approved - Amendment wrongly made but it stands';
    } else if (plan.status.id === 9) {
      plan.status.text = 'Approved - Amendment in effect';
    } else if (plan.status.id === 10) {
      plan.status.text = 'Not approved - further work required';
    } else if (plan.status.id === 11 && plan.amendmentTypeId === null) {
      plan.status.text = 'Not approved draft';
    } else if (plan.status.id === 11) {
      plan.status.text = 'Not approved amendment';
    } else if (plan.status.id === 12) {
      plan.status.text = 'Approved';
    } else if ((plan.status.id === 13 || plan.status.id === 18) && plan.amendmentTypeId === 2) {
      plan.status.text = 'Approved - mandatory amendment submitted for review';
    } else if ((plan.status.id === 13 || plan.status.id === 18) && plan.amendmentTypeId === 1) {
      plan.status.text = 'Approved - minor amendment submitted for review';
    } else if (plan.status.id === 20) {
      plan.status.text = 'Approved - Amendment in effect';
    } else if (plan.status.id === 21) {
      plan.status.text = 'Approved - Amendment not reviewed';
    } else if (plan.status.id === 22) {
      plan.status.text = 'Mandatory amendment required';
    } else if (plan.status.id === 23) {
      plan.status.text = 'Amendment in progress';
    } else if (plan.status.id === 24) {
      plan.status.text = 'Mandatory amendment submitted';
    }
  }
}
