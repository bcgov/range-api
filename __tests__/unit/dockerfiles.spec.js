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

describe('PlanController planId validation', () => {
  const controller = fs.readFileSync(path.join(projectRoot, 'src/router/controllers_v1/PlanController.ts'), 'utf8');

  it('validates planId is numeric in show()', () => {
    const showMethod = controller.match(/static async show[\s\S]*?return res\.status\(200\)\.json/m);
    expect(showMethod).not.toBeNull();
    expect(showMethod[0]).toContain('isNumeric(planId)');
    expect(showMethod[0]).toContain('throw errorWithCode');
    expect(showMethod[0]).toContain('400');
  });

  it('validates planId is numeric in update()', () => {
    const updateMethod = controller.match(/static async update[\s\S]*?agreementIdForPlanId/m);
    expect(updateMethod).not.toBeNull();
    expect(updateMethod[0]).toContain('isNumeric(planId)');
    expect(updateMethod[0]).toContain('throw errorWithCode');
    expect(updateMethod[0]).toContain('400');
  });
});
