import { NextResponse } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
    addValidationHeaders,
    createResponseValidationMiddleware,
    createValidatedResponse,
    DEFAULT_RESPONSE_VALIDATION_CONFIG,
    getValidationConfigForEnvironment,
    isResponseValidationEnabled,
    validateResponse,
    validateResponseWithSchemas,
} from '../src/utils/response-validation';

describe('Response Validation Utilities', () => {
    let originalEnv: string | undefined;

    beforeEach(() => {
        originalEnv = process.env['NODE_ENV'];
    });

    afterEach(() => {
        if (originalEnv !== undefined) {
            process.env['NODE_ENV'] = originalEnv;
        } else {
            delete process.env['NODE_ENV'];
        }
    });

    describe('validateResponse', () => {
        const validSchema = z.object({
            id: z.string(),
            name: z.string(),
            email: z.string().optional(),
        });

        it('should validate successful response in development mode', async () => {
            process.env['NODE_ENV'] = 'development';

            const validData = {
                id: '123',
                name: 'John Doe',
                email: 'john@example.com',
            };

            const response = NextResponse.json(validData);
            const result = await validateResponse(response, validSchema);

            expect(result.valid).toBe(true);
            expect(result.responseData).toEqual(validData);
        });

        it('should return validation errors in development mode', async () => {
            process.env['NODE_ENV'] = 'development';

            const invalidData = {
                id: 123, // Should be string
                name: 'John Doe',
                // Missing required fields
            };

            const response = NextResponse.json(invalidData);
            const result = await validateResponse(response, validSchema);

            expect(result.valid).toBe(false);
            expect(result.errors).toBeDefined();
            expect(result.errors).toHaveLength(1);
            if (result.errors) {
                expect(result.errors[0]?.path).toEqual(['id']);
            }
        });

        it('should validate status codes', async () => {
            process.env['NODE_ENV'] = 'development';

            const validData = {
                id: '123',
                name: 'John Doe',
            };

            const response = NextResponse.json(validData, { status: 201 });
            const result = await validateResponse(response, validSchema, 200);

            expect(result.valid).toBe(false);
            expect(result.errors).toBeDefined();
            if (result.errors) {
                expect(result.errors[0]?.code).toBe('INVALID_STATUS_CODE');
            }
        });

        it('should handle text responses', async () => {
            process.env['NODE_ENV'] = 'development';

            const response = new NextResponse('Plain text', {
                status: 200,
                headers: { 'Content-Type': 'text/plain' },
            });

            const result = await validateResponse(response, validSchema, 200);
            expect(result.valid).toBe(true); // Text responses are handled gracefully
        });
    });

    describe('validateResponseWithSchemas', () => {
        it('should validate with multiple schemas', async () => {
            process.env['NODE_ENV'] = 'development';

            const schemas = {
                200: z.object({ success: z.boolean() }),
                400: z.object({ error: z.string() }),
            };

            const response = NextResponse.json({ success: true });
            const result = await validateResponseWithSchemas(response, schemas);

            expect(result.valid).toBe(true);
        });

        it('should skip validation when disabled', async () => {
            const schemas = {
                200: z.object({ success: z.boolean() }),
            };

            const config = { enabled: false };
            const response = NextResponse.json({ invalid: 'data' });
            const result = await validateResponseWithSchemas(response, schemas, config);

            expect(result.valid).toBe(true);
        });

        it('should log warnings for missing schema', async () => {
            process.env['NODE_ENV'] = 'development';

            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            const schemas = {
                200: z.object({ success: z.boolean() }),
            };

            const response = NextResponse.json({ error: 'Not found' }, { status: 404 });
            const result = await validateResponseWithSchemas(response, schemas);

            expect(result.valid).toBe(false);
            expect(consoleSpy).toHaveBeenCalled();

            consoleSpy.mockRestore();
        });

        it('should log errors when validation fails', async () => {
            process.env['NODE_ENV'] = 'development';

            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            const schemas = {
                200: z.object({ success: z.boolean() }),
            };

            const response = NextResponse.json({ success: 'invalid' }); // Should be boolean
            const result = await validateResponseWithSchemas(response, schemas);

            expect(result.valid).toBe(false);
            expect(consoleSpy).toHaveBeenCalled();

            consoleSpy.mockRestore();
        });

        it('should throw on error when configured', async () => {
            process.env['NODE_ENV'] = 'development';

            const schemas = {
                200: z.object({ success: z.boolean() }),
            };

            const config = { throwOnError: true };
            const response = NextResponse.json({ success: 'invalid' });

            await expect(validateResponseWithSchemas(response, schemas, config)).rejects.toThrow(
                'Response validation failed'
            );
        });
    });

    describe('createValidatedResponse', () => {
        it('should create validated response', async () => {
            const schema = z.object({ message: z.string() });
            const data = { message: 'Hello' };

            const response = await createValidatedResponse(data, schema);

            expect(response).toBeInstanceOf(NextResponse);
            expect(response.status).toBe(200);
        });

        it('should handle validation errors', async () => {
            process.env['NODE_ENV'] = 'development';

            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            const schema = z.object({ message: z.string() });
            const data = { invalid: 'data' } as unknown;

            const response = await createValidatedResponse(data, schema);

            expect(response).toBeInstanceOf(NextResponse);
            expect(consoleSpy).toHaveBeenCalled();

            consoleSpy.mockRestore();
        });

        it('should create response with custom status and headers', async () => {
            const schema = z.object({ message: z.string() });
            const data = { message: 'Created' };

            const response = await createValidatedResponse(data, schema, {
                status: 201,
                headers: { 'X-Custom': 'test' },
            });

            expect(response.status).toBe(201);
            expect(response.headers.get('X-Custom')).toBe('test');
        });

        it('should throw when configured to do so', async () => {
            process.env['NODE_ENV'] = 'development';

            const schema = z.object({ message: z.string() });
            const data = { invalid: 'data' } as unknown;
            const config = { throwOnError: true };

            await expect(createValidatedResponse(data, schema, { config })).rejects.toThrow(
                'Response validation failed'
            );
        });
    });

    describe('addValidationHeaders', () => {
        it('should add validation headers', () => {
            process.env['NODE_ENV'] = 'development';

            const response = NextResponse.json({ test: true });
            const validationResult = { valid: true };

            const enhancedResponse = addValidationHeaders(response, validationResult);

            expect(enhancedResponse.headers.get('X-Response-Validation')).toBe('passed');
        });

        it('should add error headers for failed validation', () => {
            process.env['NODE_ENV'] = 'development';

            const response = NextResponse.json({ test: true });
            const validationResult = {
                valid: false,
                errors: [{ code: 'test', message: 'Test error', path: [] }],
            };

            const enhancedResponse = addValidationHeaders(response, validationResult);

            expect(enhancedResponse.headers.get('X-Response-Validation')).toBe('failed');
            expect(enhancedResponse.headers.get('X-Response-Validation-Errors')).toBeDefined();
        });

        it('should not add headers when disabled', () => {
            const response = NextResponse.json({ test: true });
            const validationResult = { valid: true };
            const config = { includeErrorsInHeaders: false };

            const enhancedResponse = addValidationHeaders(response, validationResult, config);

            expect(enhancedResponse.headers.get('X-Response-Validation')).toBeNull();
        });
    });

    describe('Utility Functions', () => {
        it('should check if validation is enabled', () => {
            expect(isResponseValidationEnabled({ enabled: true })).toBe(true);
            expect(isResponseValidationEnabled({ enabled: false })).toBe(false);
        });

        it('should get validation config for environment', () => {
            const devConfig = getValidationConfigForEnvironment('development');
            expect(devConfig.enabled).toBe(true);
            expect(devConfig.logErrors).toBe(true);

            const prodConfig = getValidationConfigForEnvironment('production');
            expect(prodConfig.enabled).toBe(false);
            expect(prodConfig.logErrors).toBe(false);

            const testConfig = getValidationConfigForEnvironment('test');
            expect(testConfig.enabled).toBe(true);
            expect(testConfig.throwOnError).toBe(true);
        });

        it('should use default config', () => {
            expect(DEFAULT_RESPONSE_VALIDATION_CONFIG).toBeDefined();
            expect(typeof DEFAULT_RESPONSE_VALIDATION_CONFIG.enabled).toBe('boolean');
        });
    });

    describe('createResponseValidationMiddleware', () => {
        it('should create middleware function', () => {
            const schemas = {
                200: z.object({ success: z.boolean() }),
            };

            const middleware = createResponseValidationMiddleware(schemas);
            expect(typeof middleware).toBe('function');
        });

        it('should process response through middleware', async () => {
            const schemas = {
                200: z.object({ success: z.boolean() }),
            };

            const middleware = createResponseValidationMiddleware(schemas, { enabled: false });
            const response = NextResponse.json({ success: true });

            const result = await middleware(response);
            expect(result).toBeInstanceOf(NextResponse);
        });
    });

    describe('Edge Cases', () => {
        it('should handle undefined response data', async () => {
            process.env['NODE_ENV'] = 'development';

            const schema = z.object({ data: z.string() });
            // Use null instead of undefined as NextResponse.json doesn't accept undefined
            const response = NextResponse.json(null);

            const result = await validateResponse(response, schema);
            expect(result.valid).toBe(false);
        });

        it('should handle null response data', async () => {
            process.env['NODE_ENV'] = 'development';

            const schema = z.object({ data: z.string() });
            const response = NextResponse.json(null);

            const result = await validateResponse(response, schema);
            expect(result.valid).toBe(false);
        });

        it('should handle complex nested schemas', async () => {
            process.env['NODE_ENV'] = 'development';

            const schema = z.object({
                user: z.object({
                    profile: z.object({
                        settings: z.object({
                            theme: z.enum(['light', 'dark']),
                        }),
                    }),
                }),
            });

            const validData = {
                user: {
                    profile: {
                        settings: {
                            theme: 'light' as const,
                        },
                    },
                },
            };

            const response = NextResponse.json(validData);
            const result = await validateResponse(response, schema);

            expect(result.valid).toBe(true);
        });

        it('should handle array responses', async () => {
            process.env['NODE_ENV'] = 'development';

            const schema = z.array(
                z.object({
                    id: z.string(),
                    name: z.string(),
                })
            );

            const validData = [
                { id: '1', name: 'User 1' },
                { id: '2', name: 'User 2' },
            ];

            const response = NextResponse.json(validData);
            const result = await validateResponse(response, schema);

            expect(result.valid).toBe(true);
        });

        it('should handle non-JSON content types', async () => {
            process.env['NODE_ENV'] = 'development';

            const schema = z.object({ test: z.string() });
            const response = new NextResponse('some text', {
                status: 200,
                headers: { 'content-type': 'text/plain' },
            });

            const result = await validateResponse(response, schema);
            expect(result.valid).toBe(true); // Non-JSON is handled gracefully
        });
    });
});
