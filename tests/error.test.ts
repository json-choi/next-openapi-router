import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import type { ValidationError } from '../src/core/types';
import {
    AuthenticationError,
    AuthorizationError,
    createAuthenticationError,
    createAuthorizationError,
    createErrorResponse,
    createInternalError,
    createMethodNotAllowedError,
    createNotFoundError,
    createValidationError,
    ERROR_CODES,
    HTTP_STATUS,
    InternalError,
    ValidationError as ValidationErrorClass,
} from '../src/utils/error';

describe('Error Utilities', () => {
    describe('createErrorResponse', () => {
        it('should create basic error response', async () => {
            const errorInfo = {
                status: HTTP_STATUS.BAD_REQUEST,
                code: ERROR_CODES.VALIDATION_ERROR,
                message: 'Test error',
            };

            const response = createErrorResponse(errorInfo);

            expect(response.status).toBe(400);
            expect(response.headers.get('Content-Type')).toBe('application/json');

            const body = await response.json();
            expect(body.error).toBe('Test error');
            expect(body.code).toBe('VALIDATION_ERROR');
            expect(body.timestamp).toBeDefined();
        });

        it('should include request details when provided', async () => {
            const request = new NextRequest('https://example.com/api/test', {
                method: 'POST',
            });

            const errorInfo = {
                status: HTTP_STATUS.NOT_FOUND,
                code: ERROR_CODES.NOT_FOUND,
                message: 'Resource not found',
            };

            const response = createErrorResponse(errorInfo, request);

            const body = await response.json();
            expect(body.path).toBe('/api/test');
            expect(body.method).toBe('POST');
        });

        it('should include validation details when provided', async () => {
            const details = [{ code: 'invalid_type', message: 'Expected string', path: ['name'] }];

            const errorInfo = {
                status: HTTP_STATUS.UNPROCESSABLE_ENTITY,
                code: ERROR_CODES.VALIDATION_ERROR,
                message: 'Validation failed',
                details,
            };

            const response = createErrorResponse(errorInfo);

            const body = await response.json();
            expect(body.details).toEqual(details);
        });
    });

    describe('createValidationError', () => {
        it('should create validation error with single error', async () => {
            const errors: ValidationError[] = [
                { code: 'required', message: 'Name is required', path: ['name'] },
            ];

            const response = createValidationError(errors);

            expect(response.status).toBe(422);

            const body = await response.json();
            expect(body.error).toBe('Name is required');
            expect(body.code).toBe('VALIDATION_ERROR');
            expect(body.details).toEqual(errors);
        });

        it('should create validation error with multiple errors', async () => {
            const errors: ValidationError[] = [
                { code: 'required', message: 'Name is required', path: ['name'] },
                { code: 'invalid_type', message: 'Age must be a number', path: ['age'] },
            ];

            const response = createValidationError(errors);

            const body = await response.json();
            expect(body.error).toBe('Validation failed with 2 errors');
            expect(body.details).toEqual(errors);
        });
    });

    describe('createAuthenticationError', () => {
        it('should create authentication error', async () => {
            const response = createAuthenticationError();

            expect(response.status).toBe(401);

            const body = await response.json();
            expect(body.error).toBe('Authentication required');
            expect(body.code).toBe('AUTHENTICATION_REQUIRED');
        });

        it('should create authentication error with custom message', async () => {
            const response = createAuthenticationError('Invalid token');

            const body = await response.json();
            expect(body.error).toBe('Invalid token');
        });
    });

    describe('createAuthorizationError', () => {
        it('should create authorization error', async () => {
            const response = createAuthorizationError();

            expect(response.status).toBe(403);

            const body = await response.json();
            expect(body.error).toBe('Insufficient permissions');
            expect(body.code).toBe('INSUFFICIENT_PERMISSIONS');
        });

        it('should create authorization error with custom message', async () => {
            const response = createAuthorizationError('Admin access required');

            const body = await response.json();
            expect(body.error).toBe('Admin access required');
        });
    });

    describe('createInternalError', () => {
        it('should create internal server error', async () => {
            const response = createInternalError();

            expect(response.status).toBe(500);

            const body = await response.json();
            expect(body.error).toBe('Internal server error');
            expect(body.code).toBe('INTERNAL_ERROR');
        });

        it('should create internal error with custom message', async () => {
            const response = createInternalError('Database connection failed');

            const body = await response.json();
            expect(body.error).toBe('Database connection failed');
        });
    });

    describe('createNotFoundError', () => {
        it('should create not found error', async () => {
            const response = createNotFoundError();

            expect(response.status).toBe(404);

            const body = await response.json();
            expect(body.error).toBe('Resource not found');
            expect(body.code).toBe('NOT_FOUND');
        });

        it('should create not found error with custom message', async () => {
            const response = createNotFoundError('User not found');

            const body = await response.json();
            expect(body.error).toBe('User not found');
        });
    });

    describe('createMethodNotAllowedError', () => {
        it('should create method not allowed error', async () => {
            const allowedMethods = ['GET', 'POST'];
            const response = createMethodNotAllowedError(allowedMethods);

            expect(response.status).toBe(405);
            expect(response.headers.get('Allow')).toBe('GET, POST');

            const body = await response.json();
            expect(body.error).toBe('Method not allowed');
            expect(body.code).toBe('METHOD_NOT_ALLOWED');
        });
    });

    describe('Custom Error Classes', () => {
        describe('ValidationError', () => {
            it('should create validation error with details', () => {
                const details = [{ code: 'required', message: 'Name is required', path: ['name'] }];

                const error = new ValidationErrorClass('Validation failed', details);

                expect(error.name).toBe('ValidationError');
                expect(error.message).toBe('Validation failed');
                expect(error.details).toEqual(details);
                expect(error.status).toBe(422);
            });
        });

        describe('AuthenticationError', () => {
            it('should create authentication error', () => {
                const error = new AuthenticationError('Invalid credentials');

                expect(error.name).toBe('AuthenticationError');
                expect(error.message).toBe('Invalid credentials');
                expect(error.status).toBe(401);
            });
        });

        describe('AuthorizationError', () => {
            it('should create authorization error', () => {
                const error = new AuthorizationError('Access denied');

                expect(error.name).toBe('AuthorizationError');
                expect(error.message).toBe('Access denied');
                expect(error.status).toBe(403);
            });
        });

        describe('InternalError', () => {
            it('should create internal error', () => {
                const error = new InternalError('Database error');

                expect(error.name).toBe('InternalError');
                expect(error.message).toBe('Database error');
                expect(error.status).toBe(500);
            });

            it('should wrap original error', () => {
                const originalError = new Error('Connection failed');
                const error = new InternalError('Database error', originalError);

                expect(error.originalError).toBe(originalError);
            });
        });
    });

    describe('Error Constants', () => {
        it('should have correct HTTP status codes', () => {
            expect(HTTP_STATUS.OK).toBe(200);
            expect(HTTP_STATUS.CREATED).toBe(201);
            expect(HTTP_STATUS.BAD_REQUEST).toBe(400);
            expect(HTTP_STATUS.UNAUTHORIZED).toBe(401);
            expect(HTTP_STATUS.FORBIDDEN).toBe(403);
            expect(HTTP_STATUS.NOT_FOUND).toBe(404);
            expect(HTTP_STATUS.METHOD_NOT_ALLOWED).toBe(405);
            expect(HTTP_STATUS.UNPROCESSABLE_ENTITY).toBe(422);
            expect(HTTP_STATUS.INTERNAL_SERVER_ERROR).toBe(500);
        });

        it('should have correct error codes', () => {
            expect(ERROR_CODES.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
            expect(ERROR_CODES.AUTHENTICATION_REQUIRED).toBe('AUTHENTICATION_REQUIRED');
            expect(ERROR_CODES.INSUFFICIENT_PERMISSIONS).toBe('INSUFFICIENT_PERMISSIONS');
            expect(ERROR_CODES.NOT_FOUND).toBe('NOT_FOUND');
            expect(ERROR_CODES.METHOD_NOT_ALLOWED).toBe('METHOD_NOT_ALLOWED');
            expect(ERROR_CODES.INTERNAL_ERROR).toBe('INTERNAL_ERROR');
            expect(ERROR_CODES.INVALID_JSON).toBe('INVALID_JSON');
            expect(ERROR_CODES.MISSING_BODY).toBe('MISSING_BODY');
        });
    });
});
