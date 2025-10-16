import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  validateData,
  formatZodError,
  validateQueryParams,
  validateRequestBody,
  validatePathParams,
  type ValidationError
} from '../src/utils/validation';

describe('Validation Utilities', () => {
  describe('validateData', () => {
    const testSchema = z.object({
      name: z.string().min(2),
      age: z.number().min(0),
      email: z.string().email().optional()
    });

    it('should validate correct data successfully', () => {
      const validData = {
        name: 'John',
        age: 25,
        email: 'john@example.com'
      };

      const result = validateData(testSchema, validData);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validData);
      }
    });

    it('should return validation errors for invalid data', () => {
      const invalidData = {
        name: 'J', // too short
        age: -5, // negative
        email: 'invalid-email' // invalid format
      };

      const result = validateData(testSchema, invalidData);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors).toHaveLength(3);
        expect(result.errors[0]?.path).toEqual(['name']);
        expect(result.errors[1]?.path).toEqual(['age']);
        expect(result.errors[2]?.path).toEqual(['email']);
      }
    });

    it('should handle missing required fields', () => {
      const incompleteData = {
        name: 'John'
        // missing age
      };

      const result = validateData(testSchema, incompleteData);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.some(err => err.path.includes('age'))).toBe(true);
      }
    });

    it('should handle null and undefined data', () => {
      expect(validateData(testSchema, null).success).toBe(false);
      expect(validateData(testSchema, undefined).success).toBe(false);
    });
  });

  describe('formatZodError', () => {
    it('should format Zod errors correctly', () => {
      const schema = z.object({
        name: z.string().min(2),
        nested: z.object({
          value: z.number()
        })
      });

      const result = schema.safeParse({
        name: 'J',
        nested: { value: 'not-a-number' }
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = formatZodError(result.error);
        
        expect(errors).toHaveLength(2);
        
        const nameError = errors.find(err => err.path.includes('name'));
        expect(nameError).toBeDefined();
        expect(nameError?.code).toBe('too_small');
        
        const nestedError = errors.find(err => err.path.includes('value'));
        expect(nestedError).toBeDefined();
        expect(nestedError?.code).toBe('invalid_type');
      }
    });
  });

  describe('validateQueryParams', () => {
    it('should validate query parameters from URL', () => {
      const schema = z.object({
        page: z.coerce.number().min(1),
        limit: z.coerce.number().max(100).optional(),
        search: z.string().optional()
      });

      const url = new URL('https://example.com/api?page=2&limit=50&search=test');
      const result = validateQueryParams(schema, url);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(2);
        expect(result.data.limit).toBe(50);
        expect(result.data.search).toBe('test');
      }
    });

    it('should handle missing query parameters', () => {
      const schema = z.object({
        page: z.coerce.number().min(1),
        limit: z.coerce.number().optional()
      });

      const url = new URL('https://example.com/api'); // no query params
      const result = validateQueryParams(schema, url);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.some(err => err.path.includes('page'))).toBe(true);
      }
    });

    it('should coerce string numbers correctly', () => {
      const schema = z.object({
        count: z.coerce.number()
      });

      const url = new URL('https://example.com/api?count=42');
      const result = validateQueryParams(schema, url);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.count).toBe(42);
        expect(typeof result.data.count).toBe('number');
      }
    });
  });

  describe('validateRequestBody', () => {
    it('should validate JSON request body', async () => {
      const schema = z.object({
        name: z.string(),
        email: z.string().email()
      });

      const body = JSON.stringify({
        name: 'John',
        email: 'john@example.com'
      });

      const request = new Request('https://example.com', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' }
      });

      const result = await validateRequestBody(schema, request);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('John');
        expect(result.data.email).toBe('john@example.com');
      }
    });

    it('should handle invalid JSON', async () => {
      const schema = z.object({
        name: z.string()
      });

      const request = new Request('https://example.com', {
        method: 'POST',
        body: '{ invalid json',
        headers: { 'Content-Type': 'application/json' }
      });

      const result = await validateRequestBody(schema, request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0]?.code).toBe('INVALID_JSON');
      }
    });

    it('should handle missing body', async () => {
      const schema = z.object({
        name: z.string()
      });

      const request = new Request('https://example.com', {
        method: 'POST'
      });

      const result = await validateRequestBody(schema, request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0]?.code).toBe('MISSING_BODY');
      }
    });
  });

  describe('validatePathParams', () => {
    it('should validate path parameters', () => {
      const schema = z.object({
        id: z.string().uuid(),
        slug: z.string().min(1)
      });

      const params = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        slug: 'test-slug'
      };

      const result = validatePathParams(schema, params);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe(params.id);
        expect(result.data.slug).toBe(params.slug);
      }
    });

    it('should handle invalid path parameters', () => {
      const schema = z.object({
        id: z.string().uuid(),
        count: z.coerce.number().min(1)
      });

      const params = {
        id: 'invalid-uuid',
        count: '0'
      };

      const result = validatePathParams(schema, params);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors.some(err => err.path.includes('id'))).toBe(true);
        expect(result.errors.some(err => err.path.includes('count'))).toBe(true);
      }
    });

    it('should handle missing path parameters', () => {
      const schema = z.object({
        id: z.string(),
        optional: z.string().optional()
      });

      const params = {}; // missing required id

      const result = validatePathParams(schema, params);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.some(err => err.path.includes('id'))).toBe(true);
      }
    });
  });
});