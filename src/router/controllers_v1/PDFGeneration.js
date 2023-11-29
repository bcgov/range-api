import Cdogs from '../../libs/cdogs';
import { AdditionalDetailsGenerator } from '../helpers/PDFHelper';

export const generatePDFResponse = async (plan) => {
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