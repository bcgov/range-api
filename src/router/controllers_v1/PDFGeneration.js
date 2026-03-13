import Cdogs from '../../libs/cdogs';
import Agreement from '../../libs/db2/model/agreement';
import { AdditionalDetailsGenerator } from '../helpers/PDFHelper';

export const generatePlanPDF = async (plan) => {
  const templateFile = Agreement.isGrazingSchedule(plan.agreement)
    ? './planTemplate_GrazingSchedule.docx'
    : './planTemplate_HaycuttingSchedule.docx';
  const dogs = new Cdogs();
  dogs.init(templateFile);
  const adg = new AdditionalDetailsGenerator();
  adg.setStatusText(plan);
  adg.setDocumentGenerationDate(plan);
  adg.setClientConfirmationStatus(plan);
  adg.setInvasivePlantCheckListIsEmpty(plan);
  adg.setMinisterIssuesPastureName(plan);
  adg.setPlantCommunityDetails(plan);
  adg.setIndicatorPlantDetails(plan);
  adg.setScheduleDetails(plan);
  const response = await dogs.generatePDF(plan);
  return response;
};

export const generateExemptionPDF = async (exemption) => {
  const dogs = new Cdogs();
  dogs.init('exemptionTemplate.docx');

  const response = await dogs.generatePDF(exemption, `${exemption.agreementId}_exemption.pdf`);
  return response;
};
