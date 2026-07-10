import DataManager from '../src/libs/db2/index.js';
import { parseRetentionDays, purgeExpiredAuditLogs, runAuditedBackgroundJob } from '../src/libs/audit.js';

async function main(): Promise<void> {
  const retentionDays = parseRetentionDays(process.env.AUDIT_RETENTION_DAYS);
  const dm = new DataManager();
  const deletedCount = await runAuditedBackgroundJob(
    dm.db,
    'audit_retention_cleanup',
    async () => purgeExpiredAuditLogs(dm.db, new Date(), retentionDays),
    {
      metadata: {
        retentionDays,
      },
    },
  );

  console.log(`Audit retention cleanup completed. deleted_rows=${deletedCount} retention_days=${retentionDays}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Audit retention cleanup failed: ${message}`);
  process.exit(1);
});
