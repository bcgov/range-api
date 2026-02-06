import Cdogs from '../../libs/cdogs';
import { AdditionalDetailsGenerator } from '../helpers/PDFHelper';

export const generatePlanPDF = async (plan) => {
  const dogs = new Cdogs();
  dogs.init();
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
