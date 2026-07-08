import KyselyModel from './KyselyModel.js';

export default class AuditLog extends KyselyModel {
  static get fields(): string[] {
    return [
      'id',
      'request_id',
      'correlation_id',
      'user_id',
      'role_id',
      'method',
      'path',
      'route',
      'status_code',
      'duration_ms',
      'success',
      'auth_reason_code',
      'action',
      'entity_type',
      'entity_id',
      'agreement_id',
      'metadata',
      'created_at',
    ];
  }

  static get table(): string {
    return 'audit_log';
  }
}
