import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const projectRoot = process.cwd();

const expectedTemplates = [
  'exemptionTemplate.docx',
  'planTemplate_GrazingSchedule.docx',
  'planTemplate_HaycuttingSchedule.docx',
];

describe('CDOGS template files', () => {
  it.each(expectedTemplates)('%s exists at project root', (file) => {
    expect(fs.existsSync(path.join(projectRoot, file))).toBe(true);
  });
});

describe('prod.Dockerfile', () => {
  const dockerfile = fs.readFileSync(path.join(projectRoot, 'prod.Dockerfile'), 'utf8');

  it('copies .docx templates from builder stage', () => {
    expect(dockerfile).toContain('COPY --from=builder /app/*.docx ./');
  });
});

describe('Agreement model replacement plan fields', () => {
  const agreement = fs.readFileSync(path.join(projectRoot, 'src/libs/db2/model/agreement.ts'), 'utf8');

  it('selects plan.replacement_of and plan.replacement_plan_id in SQL query', () => {
    expect(agreement).toContain('plan.replacement_of as plan_replacement_of');
    expect(agreement).toContain('plan.replacement_plan_id as plan_replacement_plan_id');
  });

  it('includes replacementOf and replacementPlanId in plan constructor', () => {
    expect(agreement).toContain('replacementOf: data.plan_replacement_of');
    expect(agreement).toContain('replacementPlanId: data.plan_replacement_plan_id');
  });
});
