import moment from 'moment';
import { Cdogs } from '../../libs/cdogs'
import PlanController from './PlanController'
import { calcCrownAUMs, calcDateDiff, calcPldAUMs, calcTotalAUMs, roundToSingleDecimalPlace } from '../helpers/PDFHelper';
import { NOT_PROVIDED } from '../../constants';

export default class PDFGeneration {
  static async generatePDF(req, res) {
    const {
      user,
      params,
    } = req;
    const { planId } = params;
    const dogs = new Cdogs();
    dogs.init()
    const plan = await PlanController.fetchPlan(planId, user)
    const adg = new AdditionalDetailsGenerator()
    adg.setClientConfirmationStatus(plan)
    adg.setInvasivePlantCheckListIsEmpty(plan)
    adg.setPlantCommunityDetails(plan)
    adg.setIndicatorPlantDetails(plan)
    adg.setScheduleDetails(plan)
    plan.currentDate = moment()
    const response = await dogs.generatePDF(plan)
    res.json(response).end()
  }
}

class AdditionalDetailsGenerator {
  setClientConfirmationStatus(plan) {
    for (const client of plan.agreement.clients) {
      const confirmation = plan.confirmations.find((item) => {
        return item.clientId === client.id
      })
      client.confirmationStatus = 'Not Confirmed'
      if (confirmation && confirmation.confirmed === true) {
        client.confirmationStatus = 'Confirmed'
      }
    }
  }

  setPlantCommunityDetails(plan) {
    for (const pasture of plan.pastures) {
      if (pasture) {
        for (const pasture of plan.pastures) {
          if (isNaN(pasture.pldPercentage)) {
            pasture.pldPercentage = 0
          }
        }
        if (!pasture.allowableAum)
          pasture.allowableAum = NOT_PROVIDED
        if (!pasture.pldPercent)
          pasture.pldPercent = NOT_PROVIDED
        if (!pasture.notes)
          pasture.notes = NOT_PROVIDED
        for (const plantCommunity of pasture.plantCommunities) {
          if (plantCommunity) {
            if (!plantCommunity.rangeReadinessMonth && plantCommunity.rangeReadinessDay) {
              plantCommunity.rangeReadinessDate = moment()
                .set('month', plantCommunity.rangeReadinessMonth - 1)
                .set('date', plantCommunity.rangeReadinessDay)
                .format('MMMM D')
            }
            if (plantCommunity.plantCommunityActions) {
              for (const action of plantCommunity.plantCommunityActions) {
                if (action) {
                  action.name = action.actionType.name === 'Other'
                    ? `${action.name} (Other)`
                    : action.actionType.name
                  if (action.actionType.name === 'Timing') {
                    action.NoGrazeStartDate = action.noGrazeStartMonth && action.noGrazeStartDay
                      ? moment()
                        .set('month', action.noGrazeStartMonth - 1)
                        .set('date', action.noGrazeStartDay)
                        .format('MMMM Do')
                      : 'Not Provided'
                    action.NoGrazeEndDate = action.noGrazeEndMonth && action.noGrazeEndDay
                      ? moment()
                        .set('month', action.noGrazeEndMonth - 1)
                        .set('date', action.noGrazeEndDay)
                        .format('MMMM Do')
                      : 'Not Provided'
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
              indicatorPlant.name = indicatorPlant.plantSpecies.name === 'Other'
                ? `${indicatorPlant.name} (Other)`
                : indicatorPlant.plantSpecies.name
            }
          }
        }
      }
    }
  }

  setScheduleDetails(plan) {
    for (const schedule of plan.grazingSchedules) {
      if (schedule) {
        schedule.crownTotalAUM = 0
        for (const entry of schedule.grazingScheduleEntries) {
          if (entry) {
            const pasture = plan.pastures.find((item) => {
              return item.id === entry.pastureId
            })
            entry.pasture = 'N/A'
            if (pasture) {
              entry.pasture = pasture.name
              entry.graceDays = entry.graceDays || pasture.graceDays
            }
            entry.days = calcDateDiff(entry.dateOut, entry.dateIn, false)
            entry.auFactor = entry.livestockType?.auFactor
            entry.totalAUM = calcTotalAUMs(entry.livestockCount, entry.days, entry.auFactor)
            entry.pldAUM = roundToSingleDecimalPlace(calcPldAUMs(entry.totalAUM, pasture.pldPercentage))
            entry.crownAUM = roundToSingleDecimalPlace(calcCrownAUMs(entry.totalAUM, entry.pldAUM))
            schedule.crownTotalAUM = schedule.crownTotalAUM + entry.crownAUM
          }
        }
        if (plan.agreement.usage) {
          const usage = plan.agreement.usage.find(usage => { return usage.year === schedule.year })
          schedule.authorizedAUM = usage.authorizedAum
          schedule.percentUse = ((schedule.crownTotalAUM / schedule.authorizedAUM) * 100).toFixed(2)
        }
      }
    }
  }

  setInvasivePlantCheckListIsEmpty(plan) {
    plan.invasivePlantChecklist.isEmpty = !(plan.invasivePlantChecklist.beginInUninfestedArea ||
      plan.invasivePlantChecklist.equipmentAndVehiclesParking ||
      plan.invasivePlantChecklist.revegetate ||
      plan.invasivePlantChecklist.undercarrigesInspected)
  }
}