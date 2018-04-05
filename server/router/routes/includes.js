// a class for managing all the include attributes for models in one place

export default class Includes {
  constructor(dm) {
    const {
      Client,
      // ClientType,
      ClientAgreement,
      Usage,
      // Agreement,
      AgreementExemptionStatus,
      Zone,
      District,
      LivestockIdentifier,
      LivestockIdentifierLocation,
      LivestockIdentifierType,
      Pasture,
      Plan,
      PlanStatus,
      GrazingSchedule,
      GrazingScheduleEntry,
      LivestockType,
    } = dm;

    this.INCLUDE_DISTRICT_MODEL = {
      model: District,
      attributes: {
        exclude: ['createdAt', 'updatedAt'],
      },
    };

    this.INCLUDE_ZONE_MODEL = {
      model: Zone,
      include: [this.INCLUDE_DISTRICT_MODEL],
      attributes: {
        exclude: ['districtId', 'createdAt', 'updatedAt', 'user_id', 'district_id'],
      },
    };

    this.INCLUDE_CLIENT_MODEL = {
      model: Client,
      through: {
        model: ClientAgreement,
        attributes: ['clientTypeId'],
      },
      attributes: ['id', 'name', 'locationCode', 'startDate'],
    };

    this.INCLUDE_AGREEMENT_EXEMPTION_STATUS_MODEL = {
      model: AgreementExemptionStatus,
      attributes: {
        exclude: ['active', 'createdAt', 'updatedAt'],
      },
    };

    this.INCLUDE_LIVESTOCK_IDENTIFIER_MODEL = {
      model: LivestockIdentifier,
      include: [LivestockIdentifierLocation, LivestockIdentifierType],
      attributes: {
        exclude: ['livestock_identifier_type_id', 'livestock_identifier_location_id'],
      },
    };

    this.INCLUDE_PLAN_STATUS_MODEL = {
      model: PlanStatus,
      as: 'status',
    };

    this.INCLUDE_PASTURE_MODEL = {
      model: Pasture,
      attributes: {
        exclude: ['plan_id'],
      },
    };

    this.INCLUDE_GRAZING_SCHEDULE_MODEL = {
      model: GrazingSchedule,
      include: [{
        model: GrazingScheduleEntry,
        include: [LivestockType, Pasture],
        attributes: {
          exclude: ['grazing_schedule_id', 'livestock_type_id', 'plan_grazing_schedule'],
        },
      }],
    };

    this.EXCLUDED_PLAN_ATTR = ['status_id', 'agreement_id'];
    this.INCLUDE_PLAN_MODEL = {
      model: Plan,
      attributes: {
        exclude: this.EXCLUDED_PLAN_ATTR,
      },
      order: [
        ['create_at', 'DESC'],
      ],
      include: [
        this.INCLUDE_PLAN_STATUS_MODEL,
        this.INCLUDE_PASTURE_MODEL,
        this.INCLUDE_GRAZING_SCHEDULE_MODEL,
      ],
    };
    this.STANDARD_PLAN_INCLUDE = [
      this.INCLUDE_PLAN_STATUS_MODEL,
      this.INCLUDE_PASTURE_MODEL,
      this.INCLUDE_GRAZING_SCHEDULE_MODEL,
    ];

    this.INCLUDE_USAGE_MODEL = {
      model: Usage,
      as: 'usage',
      attributes: {
        exclude: ['agreement_id', 'agreementId', 'createdAt', 'updatedAt'],
      },
    };

    this.EXCLUDED_AGREEMENT_ATTR = [
      'agreementTypeId',
      'zoneId',
      'agreementExemptionStatusId',
      'agreement_type_id',
    ];
    this.STANDARD_INCLUDE_NO_ZONE = [
      this.INCLUDE_CLIENT_MODEL,
      this.INCLUDE_AGREEMENT_EXEMPTION_STATUS_MODEL,
      this.INCLUDE_LIVESTOCK_IDENTIFIER_MODEL,
      this.INCLUDE_PLAN_MODEL,
      this.INCLUDE_USAGE_MODEL,
    ];
  }
}
