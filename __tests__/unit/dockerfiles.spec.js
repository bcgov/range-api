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
