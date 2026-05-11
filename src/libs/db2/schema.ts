import type { ColumnType } from 'kysely';

export interface UserAccountTable {
  id: ColumnType<number, number, never>;
  username: string;
  given_name: string | null;
  family_name: string | null;
  email: string | null;
  phone_number: string | null;
  active: boolean | null;
  pia_seen: boolean | null;
  last_login_at: Date | null;
  sso_id: string | null;
  role_id: number | null;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, Date>;
}

export interface UserClientLinkTable {
  id: ColumnType<number, number, never>;
  user_id: number;
  client_id: string;
  active: boolean | null;
  type: string | null;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, Date>;
}

export interface UserDistrictsTable {
  id: ColumnType<number, number, never>;
  user_id: number;
}

export interface UserFeedbackTable {
  id: ColumnType<number, number, never>;
  user_id: number | null;
  feedback: string | null;
  section: string | null;
  created_at: ColumnType<Date, string | undefined, never>;
}

export interface RolePermissionsTable {
  id: ColumnType<number, number, never>;
  role_id: number | null;
  permission_id: number | null;
}

export interface RefClientTable {
  client_number: string;
  location_codes: string[] | null;
  name: string;
  licensee_start_date: Date | null;
  licensee_end_date: Date | null;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, Date>;
}

export interface AgreementTable {
  forest_file_id: string;
  agreement_start_date: Date;
  agreement_end_date: Date;
  agreement_type_id: number;
  zone_id: number;
  retired: boolean | null;
  usage_status: number | null;
  percentage_use: number | null;
  has_current_schedule: number | null;
  exemption_status: string;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, Date>;
}

export interface ClientAgreementTable {
  id: ColumnType<number, number, never>;
  agreement_id: string;
  client_id: string | null;
  client_type_id: number;
  agent_id: number | null;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, Date>;
}

export interface RefClientTypeTable {
  id: ColumnType<number, number, never>;
  code: string;
  description: string;
  active: boolean;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, Date>;
}

export interface RefAgreementTypeTable {
  id: ColumnType<number, number, never>;
  code: string;
  description: string;
  active: boolean;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, Date>;
}

export interface AgreementExemptionStatusTable {
  id: ColumnType<number, number, never>;
  code: string;
  description: string;
  active: boolean;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, Date>;
}

export interface RefZoneTable {
  id: ColumnType<number, number, never>;
  code: string;
  description: string;
  district_id: number;
  user_id: number | null;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, Date>;
}

export interface RefDistrictTable {
  id: ColumnType<number, number, never>;
  code: string;
  description: string;
  user_id: number | null;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, Date>;
}

// ---- Plan-related tables ----

export interface PlanTable {
  id: ColumnType<number, number, never>;
  agreement_id: string;
  status_id: number;
  amendment_type_id: number | null;
  creator_id: number;
  range_name: string;
  alt_business_name: string | null;
  plan_start_date: Date | null;
  plan_end_date: Date | null;
  notes: string | null;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, Date>;
  uploaded: ColumnType<boolean, boolean, boolean>;
  effective_at: Date | null;
  submitted_at: Date | null;
  canonical_id: number | null;
  is_restored: boolean | null;
  conditions: string | null;
  proposed_conditions: string | null;
  extension_status: number | null;
  replacement_of: number | null;
  extension_required_votes: number | null;
  extension_received_votes: number | null;
  extension_date: Date | null;
  extension_rejected_by: number | null;
  replacement_plan_id: number | null;
  livestock_distribution_detail: string | null;
}

export interface PastureTable {
  id: ColumnType<number, number, never>;
  plan_id: number;
  name: string;
  allowable_aum: number | null;
  grace_days: number | null;
  pld_percent: number | null;
  notes: string | null;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, Date>;
  canonical_id: number | null;
}

export interface GrazingScheduleTable {
  id: ColumnType<number, number, never>;
  plan_id: number;
  year: number;
  narative: string | null;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, Date>;
  canonical_id: number | null;
  sort_by: string | null;
  sort_order: string | null;
}

export interface GrazingScheduleEntryTable {
  id: ColumnType<number, number, never>;
  livestock_type_id: number;
  grazing_schedule_id: number;
  pasture_id: number;
  date_in: Date | null;
  date_out: Date | null;
  grace_days: number | null;
  livestock_count: number | null;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, Date>;
  canonical_id: number | null;
  crown_au_ms: number | null;
}

export interface HayCuttingScheduleEntryTable {
  id: ColumnType<number, number, never>;
  haycutting_schedule_id: number;
  pasture_id: number;
  date_in: Date | null;
  date_out: Date | null;
  stubble_height: number;
  tonnes: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, Date>;
  canonical_id: number | null;
}

export interface PlantCommunityTable {
  id: ColumnType<number, number, never>;
  community_type_id: number;
  elevation_id: number | null;
  pasture_id: number;
  purpose_of_action: string;
  approved: ColumnType<boolean, boolean, boolean>;
  name: string | null;
  aspect: string | null;
  url: string | null;
  notes: string | null;
  range_readiness_day: number | null;
  range_readiness_month: number | null;
  range_readiness_note: string | null;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, Date>;
  shrub_use: number | null;
  canonical_id: number | null;
}

export interface PlantCommunityActionTable {
  id: ColumnType<number, number, never>;
  action_type_id: number | null;
  plant_community_id: number;
  name: string | null;
  details: string | null;
  no_graze_start_day: number | null;
  no_graze_start_month: number | null;
  no_graze_end_day: number | null;
  no_graze_end_month: number | null;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, Date>;
  canonical_id: number | null;
}

export interface IndicatorPlantTable {
  id: ColumnType<number, number, never>;
  plant_species_id: number | null;
  plant_community_id: number;
  criteria: string;
  name: string | null;
  value: number | null;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, Date>;
  canonical_id: number | null;
}

export interface MonitoringAreaTable {
  id: ColumnType<number, number, never>;
  rangeland_health_id: number | null;
  plant_community_id: number;
  name: string;
  other_purpose: string | null;
  location: string | null;
  transect_azimuth: number | null;
  latitude: number | null;
  longitude: number | null;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, Date>;
  canonical_id: number | null;
}

export interface MonitoringAreaPurposeTable {
  id: ColumnType<number, number, never>;
  purpose_type_id: number;
  monitoring_area_id: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, Date>;
  canonical_id: number | null;
}

export interface AdditionalRequirementTable {
  id: ColumnType<number, number, never>;
  category_id: number | null;
  plan_id: number;
  detail: string | null;
  url: string | null;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, Date>;
  canonical_id: number | null;
}

export interface ManagementConsiderationTable {
  id: ColumnType<number, number, never>;
  consideration_type_id: number | null;
  plan_id: number;
  detail: string | null;
  url: string | null;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, Date>;
  canonical_id: number | null;
}

export interface MinisterIssueTable {
  id: ColumnType<number, number, never>;
  plan_id: number;
  issue_type_id: number;
  detail: string | null;
  objective: string | null;
  identified: ColumnType<boolean, boolean, boolean>;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, Date>;
  canonical_id: number | null;
}

export interface MinisterIssueActionTable {
  id: ColumnType<number, number, never>;
  action_type_id: number;
  issue_id: number;
  other: string | null;
  detail: string | null;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, Date>;
  no_graze_start_day: number | null;
  no_graze_start_month: number | null;
  no_graze_end_day: number | null;
  no_graze_end_month: number | null;
  canonical_id: number | null;
}

export interface MinisterIssuePastureTable {
  id: ColumnType<number, number, never>;
  minister_issue_id: number;
  pasture_id: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, Date>;
  canonical_id: number | null;
}

export interface PlanConfirmationTable {
  id: ColumnType<number, number, never>;
  plan_id: number;
  confirmed: ColumnType<boolean, boolean, boolean>;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, Date>;
  user_id: number | null;
  is_own_signature: ColumnType<boolean, boolean, boolean>;
  client_id: string | null;
  is_manual_confirmation: boolean | null;
}

export interface PlanExtensionRequestsTable {
  id: ColumnType<number, number, never>;
  plan_id: number | null;
  client_id: string | null;
  user_id: number | null;
  email: string | null;
  requested_extension: boolean | null;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, Date>;
}

export interface PlanStatusHistoryTable {
  id: ColumnType<number, number, never>;
  plan_id: number;
  from_plan_status_id: number | null;
  to_plan_status_id: number;
  user_id: number;
  note: string;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, Date>;
}

export interface PlanFileTable {
  id: ColumnType<number, number, never>;
  name: string;
  url: string;
  type: string;
  access: string;
  plan_id: number;
  user_id: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, Date>;
}

export interface PlanSnapshotTable {
  id: ColumnType<number, number, never>;
  snapshot: any;
  plan_id: number;
  created_at: ColumnType<Date, string | undefined, never>;
  status_id: number | null;
  version: ColumnType<number, number, never>;
  user_id: number | null;
  is_discarded: ColumnType<boolean, boolean, boolean>;
  pdf_file: any;
}

export interface PlanVersionTable {
  version: ColumnType<number, number, never>;
  canonical_id: ColumnType<number, number, never>;
  plan_id: number | null;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, Date>;
}

export interface InvasivePlantChecklistTable {
  id: ColumnType<number, number, never>;
  plan_id: number;
  equipment_and_vehicles_parking: boolean | null;
  begin_in_uninfested_area: boolean | null;
  undercarriges_inspected: boolean | null;
  revegetate: boolean | null;
  other: string | null;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, Date>;
  canonical_id: number | null;
}

// ---- Reference tables ----

export interface RefPlanStatusTable {
  id: ColumnType<number, number, never>;
  code: string;
  name: string;
  active: ColumnType<boolean, boolean, boolean>;
  description_full: string | null;
  description_short: string | null;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, Date>;
}

export interface RefLivestockTable {
  id: ColumnType<number, number, never>;
  name: string;
  au_factor: number;
  active: ColumnType<boolean, boolean, boolean>;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, Date>;
}

export interface RefPlantCommunityTypeTable {
  id: ColumnType<number, number, never>;
  name: string;
  active: ColumnType<boolean, boolean, boolean>;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, Date>;
}

export interface RefPlantCommunityElevationTable {
  id: ColumnType<number, number, never>;
  name: string;
  active: ColumnType<boolean, boolean, boolean>;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, Date>;
}

export interface RefPlantSpeciesTable {
  id: ColumnType<number, number, never>;
  name: string;
  leaf_stage: number | null;
  stubble_height: number | null;
  annual_growth: number | null;
  is_shrub_use: ColumnType<boolean, boolean, boolean>;
  active: ColumnType<boolean, boolean, boolean>;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, Date>;
}

export interface RefPlantCommunityActionTypeTable {
  id: ColumnType<number, number, never>;
  name: string;
  active: ColumnType<boolean, boolean, boolean>;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, Date>;
}

export interface RefMonitoringAreaHealthTable {
  id: ColumnType<number, number, never>;
  name: string;
  active: ColumnType<boolean, boolean, boolean>;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, Date>;
}

export interface RefMonitoringAreaPurposeTypeTable {
  id: ColumnType<number, number, never>;
  name: string;
  active: ColumnType<boolean, boolean, boolean>;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, Date>;
}

export interface RefAdditionalRequirementCategoryTable {
  id: ColumnType<number, number, never>;
  name: string;
  active: ColumnType<boolean, boolean, boolean>;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, Date>;
}

export interface RefManagementConsiderationTypeTable {
  id: ColumnType<number, number, never>;
  name: string;
  active: ColumnType<boolean, boolean, boolean>;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, Date>;
}

export interface RefMinisterIssueTypeTable {
  id: ColumnType<number, number, never>;
  name: string;
  active: ColumnType<boolean, boolean, boolean>;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, Date>;
}

export interface RefMinisterIssueActionTypeTable {
  id: ColumnType<number, number, never>;
  name: string;
  placeholder: string | null;
  active: ColumnType<boolean, boolean, boolean>;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, Date>;
}

export interface ExemptionStatusTypeTable {
  id: ColumnType<number, number, never>;
  code: string;
  description: string;
  active: boolean;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, Date>;
}

export interface ExemptionTable {
  id: ColumnType<number, number, never>;
  agreement_id: string;
  user_id: number;
  start_date: Date;
  end_date: Date;
  reason: string | null;
  justification_text: string | null;
  status: string;
  approved_by: number | null;
  approval_date: Date | null;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, Date>;
}

export interface ExemptionAttachmentTable {
  id: ColumnType<number, number, never>;
  name: string;
  url: string;
  type: string;
  access: string;
  exemption_id: number;
  user_id: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, Date>;
}

export interface ExemptionStatusHistoryTable {
  id: ColumnType<number, number, never>;
  exemption_id: number;
  from_status: string | null;
  to_status: string;
  note: string | null;
  user_id: number;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, Date>;
}

export interface RefLivestockIdentifierTypeTable {
  id: ColumnType<number, number, never>;
  description: string;
  active: boolean;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, Date>;
}

export interface RefLivestockIdentifierLocationTable {
  id: ColumnType<number, number, never>;
  description: string;
  active: boolean;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, Date>;
}

export interface LivestockIdentifierTable {
  id: ColumnType<number, number, never>;
  livestock_identifier_location_id: number;
  livestock_identifier_type_id: number;
  image_ref: string | null;
  description: string | null;
  accepted: boolean | null;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, Date>;
}

export interface RefUsageTable {
  id: ColumnType<number, number, never>;
  year: number;
  authorized_aum: number | null;
  temporary_increase: number | null;
  total_non_use: number | null;
  total_annual_use: number | null;
  agreement_id: string;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, Date>;
}

export interface EmailTemplateTable {
  id: ColumnType<number, number, never>;
  name: string;
  from_email: string;
  subject: string;
  body: string;
}

export interface VersionTable {
  lock: string;
  ios: string | null;
  api: string | null;
  idp_hint: string | null;
}

export interface RolesTable {
  id: ColumnType<number, number, never>;
  description: string;
}

export interface PermissionsTable {
  id: ColumnType<number, number, never>;
  description: string;
}

export interface RefAmendmentTypeTable {
  id: ColumnType<number, number, never>;
  code: string;
  description: string;
  active: ColumnType<boolean, boolean, boolean>;
  created_at: ColumnType<Date, string | undefined, never>;
  updated_at: ColumnType<Date, string | undefined, Date>;
}

export interface DB {
  user_account: UserAccountTable;
  user_client_link: UserClientLinkTable;
  user_districts: UserDistrictsTable;
  user_feedback: UserFeedbackTable;
  role_permissions: RolePermissionsTable;
  ref_client: RefClientTable;
  agreement: AgreementTable;
  client_agreement: ClientAgreementTable;
  ref_client_type: RefClientTypeTable;
  ref_agreement_type: RefAgreementTypeTable;
  agreement_exemption_status: AgreementExemptionStatusTable;
  ref_zone: RefZoneTable;
  ref_district: RefDistrictTable;
  plan: PlanTable;
  pasture: PastureTable;
  grazing_schedule: GrazingScheduleTable;
  grazing_schedule_entry: GrazingScheduleEntryTable;
  haycutting_schedule_entry: HayCuttingScheduleEntryTable;
  plant_community: PlantCommunityTable;
  plant_community_action: PlantCommunityActionTable;
  indicator_plant: IndicatorPlantTable;
  monitoring_area: MonitoringAreaTable;
  monitoring_area_purpose: MonitoringAreaPurposeTable;
  additional_requirement: AdditionalRequirementTable;
  management_consideration: ManagementConsiderationTable;
  minister_issue: MinisterIssueTable;
  minister_issue_action: MinisterIssueActionTable;
  minister_issue_pasture: MinisterIssuePastureTable;
  plan_confirmation: PlanConfirmationTable;
  plan_extension_requests: PlanExtensionRequestsTable;
  plan_status_history: PlanStatusHistoryTable;
  plan_file: PlanFileTable;
  plan_snapshot: PlanSnapshotTable;
  plan_version: PlanVersionTable;
  invasive_plant_checklist: InvasivePlantChecklistTable;
  ref_plan_status: RefPlanStatusTable;
  ref_livestock: RefLivestockTable;
  ref_plant_community_type: RefPlantCommunityTypeTable;
  ref_plant_community_elevation: RefPlantCommunityElevationTable;
  ref_plant_species: RefPlantSpeciesTable;
  ref_plant_community_action_type: RefPlantCommunityActionTypeTable;
  ref_monitoring_area_health: RefMonitoringAreaHealthTable;
  ref_monitoring_area_purpose_type: RefMonitoringAreaPurposeTypeTable;
  ref_additional_requirement_category: RefAdditionalRequirementCategoryTable;
  ref_management_consideration_type: RefManagementConsiderationTypeTable;
  ref_minister_issue_type: RefMinisterIssueTypeTable;
  ref_minister_issue_action_type: RefMinisterIssueActionTypeTable;
  ref_amendment_type: RefAmendmentTypeTable;
  exemption_status_type: ExemptionStatusTypeTable;
  exemption: ExemptionTable;
  exemption_attachment: ExemptionAttachmentTable;
  exemption_status_history: ExemptionStatusHistoryTable;
  ref_livestock_identifier_type: RefLivestockIdentifierTypeTable;
  ref_livestock_identifier_location: RefLivestockIdentifierLocationTable;
  livestock_identifier: LivestockIdentifierTable;
  ref_usage: RefUsageTable;
  email_template: EmailTemplateTable;
  version: VersionTable;
  roles: RolesTable;
  permissions: PermissionsTable;
}
