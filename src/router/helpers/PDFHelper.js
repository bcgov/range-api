import moment from "moment";
import { DAYS_ON_THE_AVERAGE, NOT_PROVIDED } from "../../constants";

const shift = (number, precision) => {
  const numArray = `${number}`.split("e");
  return +`${numArray[0]}e${numArray[1] ? +numArray[1] + precision : precision}`;
};

const round = (number, precision) =>
  shift(Math.round(shift(number, +precision)), -precision);

/**
 * Round the float to 1 decimal
 *
 * @param {float} number
 * @returns the rounded float number
 */
export const roundToSingleDecimalPlace = (number) => round(number, 1);

/**
 *
 * @param {number} numberOfAnimals
 * @param {number} totalDays
 * @param {number} auFactor parameter provided from the livestock type
 * @returns {float} the total AUMs
 */
export const calcTotalAUMs = (numberOfAnimals = 0, totalDays, auFactor = 0) =>
  (numberOfAnimals * totalDays * auFactor) / DAYS_ON_THE_AVERAGE;

/**
 * Present user friendly string when getting null or undefined value
 *
 * @param {string | Date} first the string in the class Date form
 * @param {string | Date} second the string in the class Date form
 * @param {bool} isUserFriendly
 * @returns {number | string} the number of days or 'N/P'
 */
export const calcDateDiff = (first, second, isUserFriendly) => {
  if (first && second) {
    return moment(first).diff(moment(second), "days") + 1;
  }
  return isUserFriendly ? "N/P" : 0;
};

/**
 * Calculate Private Land Deduction Animal Unit Month
 *
 * @param {number} totalAUMs
 * @param {float} pasturePldPercent
 * @returns {float} the pld AUMs
 */
export const calcPldAUMs = (totalAUMs, pasturePldPercent = 0) =>
  totalAUMs * pasturePldPercent;

/**
 * Calculate Crown Animal Unit Month
 *
 * @param {number} totalAUMs
 * @param {number} pldAUMs
 * @returns {float} the crown AUMs
 */
export const calcCrownAUMs = (totalAUMs, pldAUMs) => totalAUMs - pldAUMs;

/**
 * Calculate the total Crown Animal Unit Month
 *
 * @param {Array} entries grazing schedule entries
 * @returns {float} the total crown AUMs
 */
export const calcCrownTotalAUMs = (entries = []) => {
  const reducer = (accumulator, currentValue) => accumulator + currentValue;
  if (entries.length === 0) {
    return 0;
  }
  return entries.map((entry) => entry.crownAUMs).reduce(reducer);
};

export class AdditionalDetailsGenerator {
  setDocumentGenerationDate(plan) {
    plan.currentDate = moment();
  }

  setClientConfirmationStatus(plan) {
    for (const client of plan.agreement.clients) {
      const confirmation = plan.confirmations.find(
        (item) => item.clientId === client.id,
      );
      client.confirmationStatus = "Not Confirmed";
      if (confirmation && confirmation.confirmed === true) {
        client.confirmationStatus = "Confirmed";
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
            if (
              !plantCommunity.rangeReadinessMonth &&
              plantCommunity.rangeReadinessDay
            ) {
              plantCommunity.rangeReadinessDate = moment()
                .set("month", plantCommunity.rangeReadinessMonth - 1)
                .set("date", plantCommunity.rangeReadinessDay)
                .format("MMMM D");
            }
            if (plantCommunity.plantCommunityActions) {
              for (const action of plantCommunity.plantCommunityActions) {
                if (action) {
                  action.name =
                    action.actionType.name === "Other"
                      ? `${action.name} (Other)`
                      : action.actionType.name;
                  if (action.actionType.name === "Timing") {
                    action.NoGrazeStartDate =
                      action.noGrazeStartMonth && action.noGrazeStartDay
                        ? moment()
                            .set("month", action.noGrazeStartMonth - 1)
                            .set("date", action.noGrazeStartDay)
                            .format("MMMM Do")
                        : "Not Provided";
                    action.NoGrazeEndDate =
                      action.noGrazeEndMonth && action.noGrazeEndDay
                        ? moment()
                            .set("month", action.noGrazeEndMonth - 1)
                            .set("date", action.noGrazeEndDay)
                            .format("MMMM Do")
                        : "Not Provided";
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
                indicatorPlant.plantSpecies.name === "Other"
                  ? `${indicatorPlant.name} (Other)`
                  : indicatorPlant.plantSpecies.name;
            }
          }
        }
      }
    }
  }

  setScheduleDetails(plan) {
    for (const schedule of plan.grazingSchedules) {
      if (schedule) {
        schedule.crownTotalAUM = 0;
        for (const entry of schedule.grazingScheduleEntries) {
          if (entry) {
            const pasture = plan.pastures.find(
              (item) => item.id === entry.pastureId,
            );
            entry.pasture = "N/A";
            if (pasture) {
              entry.pasture = pasture.name;
              entry.graceDays = entry.graceDays || pasture.graceDays;
            }
            entry.days = calcDateDiff(entry.dateOut, entry.dateIn, false);
            entry.auFactor = entry.livestockType?.auFactor;
            entry.totalAUM = calcTotalAUMs(
              entry.livestockCount,
              entry.days,
              entry.auFactor,
            );
            entry.pldAUM = calcPldAUMs(entry.totalAUM, pasture.pldPercent);
            entry.crownAUM = calcCrownAUMs(entry.totalAUM, entry.pldAUM);
            schedule.crownTotalAUM += entry.crownAUM;
            entry.crownAUM = entry.crownAUM.toFixed(1);
          }
        }
        schedule.crownTotalAUM = schedule.crownTotalAUM.toFixed(1);
        if (plan.agreement.usage) {
          const usage = plan.agreement.usage.find(
            (element) => element.year === schedule.year,
          );
          if (usage) schedule.authorizedAUM = usage.authorizedAum;
          if (schedule.authorizedAUM) {
            schedule.percentUse = (
              (schedule.crownTotalAUM / schedule.authorizedAUM) *
              100
            ).toFixed(2);
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
      plan.status.text = "Draft";
    } else if (plan.status.id === 7) {
      plan.status.text = "Not Approved - Amendment without effect";
    } else if (plan.status.id === 8) {
      plan.status.text = "Approved - Amendment wrongly made but it stands";
    } else if (plan.status.id === 9) {
      plan.status.text = "Approved - Amendment in effect";
    } else if (plan.status.id === 10) {
      plan.status.text = "Not approved - further work required";
    } else if (plan.status.id === 11 && plan.amendmentTypeId === null) {
      plan.status.text = "Not approved draft";
    } else if (plan.status.id === 11) {
      plan.status.text = "Not approved amendment";
    } else if (plan.status.id === 12) {
      plan.status.text = "Approved";
    } else if (
      (plan.status.id === 13 || plan.status.id === 18) &&
      plan.amendmentTypeId === 2
    ) {
      plan.status.text = "Approved - mandatory amendment submitted for review";
    } else if (
      (plan.status.id === 13 || plan.status.id === 18) &&
      plan.amendmentTypeId === 1
    ) {
      plan.status.text = "Approved - minor amendment submitted for review";
    } else if (plan.status.id === 19) {
      plan.status.text = "Approved - Amendment in effect";
    } else if (plan.status.id === 20) {
      plan.status.text = "Approved - Amendment in effect";
    } else if (plan.status.id === 21) {
      plan.status.text = "Approved - Amendment not reviewed";
    } else if (plan.status.id === 22) {
      plan.status.text = "Mandatory amendment required";
    } else if (plan.status.id === 23) {
      plan.status.text = "Amendment in progress";
    } else if (plan.status.id === 24) {
      plan.status.text = "Mandatory amendment submitted";
    }
  }
}
