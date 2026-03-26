import { describe, it, expect } from 'vitest';
import { z } from 'zod';

describe('Zod Validation Tests', () => {
  const agreementSchema = z
    .object({
      forestFileId: z.string().min(1).max(20),
      agreementStartDate: z.date(),
      agreementEndDate: z.date(),
      agreementTypeId: z.number(),
      zoneId: z.number(),
      exemptionStatus: z.string().default('NOT_EXEMPTED'),
    })
    .refine((data) => data.agreementEndDate > data.agreementStartDate, {
      message: 'End date must be after start date',
      path: ['agreementEndDate'],
    });

  it('should validate a valid agreement', () => {
    const validAgreement = {
      forestFileId: 'RAN073578',
      agreementStartDate: new Date('2026-01-01'),
      agreementEndDate: new Date('2040-12-31'),
      agreementTypeId: 1,
      zoneId: 1,
    };

    const result = agreementSchema.safeParse(validAgreement);
    expect(result.success).toBe(true);
  });

  it('should reject agreement with empty forestFileId', () => {
    const invalidAgreement = {
      forestFileId: '',
      agreementStartDate: new Date(),
      agreementEndDate: new Date(),
      agreementTypeId: 1,
      zoneId: 1,
    };

    const result = agreementSchema.safeParse(invalidAgreement);
    expect(result.success).toBe(false);
  });

  it('should reject agreement with endDate before startDate', () => {
    const invalidAgreement = {
      forestFileId: 'RAN073578',
      agreementStartDate: new Date('2030-01-01'),
      agreementEndDate: new Date('2020-01-01'),
      agreementTypeId: 1,
      zoneId: 1,
    };

    const result = agreementSchema.safeParse(invalidAgreement);
    expect(result.success).toBe(false);
  });

  it('should apply default exemptionStatus', () => {
    const partialAgreement = {
      forestFileId: 'RAN073578',
      agreementStartDate: new Date('2026-01-01'),
      agreementEndDate: new Date('2026-01-02'),
      agreementTypeId: 1,
      zoneId: 1,
    };

    const result = agreementSchema.parse(partialAgreement);
    expect(result.exemptionStatus).toBe('NOT_EXEMPTED');
  });
});

describe('String Validation Tests', () => {
  it('should validate RAN format', () => {
    const ranPattern = /^RAN\d{6}$/;

    expect(ranPattern.test('RAN073578')).toBe(true);
    expect(ranPattern.test('RAN123456')).toBe(true);
    expect(ranPattern.test('RAN12345')).toBe(false);
    expect(ranPattern.test('RAN1234567')).toBe(false);
    expect(ranPattern.test('RAN12345X')).toBe(false);
  });
});
