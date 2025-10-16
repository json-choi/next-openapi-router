import { NextResponse, type NextRequest } from 'next/server';
import type { ValidationError as CoreValidationError, ErrorResponse } from '../core/types';

/**
 * HTTP status codes for different error types
 */
export const HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    METHOD_NOT_ALLOWED: 405,
    CONFLICT: 409,
    UNPROCESSABLE_ENTITY: 422,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
    BAD_GATEWAY: 502,
    SERVICE_UNAVAILABLE: 503,
} as const;

/**
 * Standard error codes used throughout the application
 */
export const ERROR_CODES = {
    // Authentication errors
    AUTHENTICATION_REQUIRED: 'AUTHENTICATION_REQUIRED',
    AUTH_REQUIRED: 'AUTH_REQUIRED',
    INVALID_TOKEN: 'INVALID_TOKEN',
    TOKEN_EXPIRED: 'TOKEN_EXPIRED',
    INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',

    // Validation errors
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    INVALID_JSON: 'INVALID_JSON',
    INVALID_CONTENT_TYPE: 'INVALID_CONTENT_TYPE',
    MISSING_BODY: 'MISSING_BODY',
    MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',

    // Server errors
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
    SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',

    // Route errors
    METHOD_NOT_ALLOWED: 'METHOD_NOT_ALLOWED',
    NOT_FOUND: 'NOT_FOUND',
    ROUTE_NOT_FOUND: 'ROUTE_NOT_FOUND',

    // Rate limiting
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
} as const;

/**
 * Create a standardized error response
 * @param config - Error configuration
 * @param request - The original request (for context)
 * @returns NextResponse with error payload
 */
export function createErrorResponse(
    config: {
        status: number;
        code: string;
        message: string;
        details?: CoreValidationError[];
    },
    request?: NextRequest
): NextResponse {
    const errorResponse: ErrorResponse = {
        error: config.message,
        code: config.code,
        message: config.message,
        timestamp: new Date().toISOString(),
        path: request?.nextUrl?.pathname ?? 'unknown',
        method: request?.method ?? 'unknown',
        ...(config.details && { details: config.details }),
    };

    return NextResponse.json(errorResponse, {
        status: config.status,
        headers: {
            'Content-Type': 'application/json',
        },
    });
}

/**
 * Create an authentication error response
 * @param message - Optional custom error message
 * @param request - The original request
 * @returns NextResponse with 401 status
 */
export function createAuthenticationError(
    message = 'Authentication required',
    request?: NextRequest
): NextResponse {
    return createErrorResponse(
        {
            status: HTTP_STATUS.UNAUTHORIZED,
            code: ERROR_CODES.AUTHENTICATION_REQUIRED,
            message,
        },
        request
    );
}

// Alias for backward compatibility
export const createAuthError = createAuthenticationError;

/**
 * Create a forbidden error response
 * @param message - Optional custom error message
 * @param request - The original request
 * @returns NextResponse with 403 status
 */
export function createAuthorizationError(
    message = 'Insufficient permissions',
    request?: NextRequest
): NextResponse {
    return createErrorResponse(
        {
            status: HTTP_STATUS.FORBIDDEN,
            code: ERROR_CODES.INSUFFICIENT_PERMISSIONS,
            message,
        },
        request
    );
}

// Alias for backward compatibility
export const createForbiddenError = createAuthorizationError;

/**
 * Create a validation error response
 * @param errors - Array of validation errors
 * @param request - The original request
 * @returns NextResponse with 422 status
 */
export function createValidationError(
    errors: CoreValidationError[],
    request?: NextRequest
): NextResponse {
    const message =
        errors.length === 1
            ? (errors[0]?.message ?? 'Validation failed')
            : `Validation failed with ${errors.length} errors`;

    return createErrorResponse(
        {
            status: HTTP_STATUS.UNPROCESSABLE_ENTITY,
            code: ERROR_CODES.VALIDATION_ERROR,
            message,
            details: errors,
        },
        request
    );
}

/**
 * Create an internal server error response
 * @param error - The original error
 * @param request - The original request
 * @returns NextResponse with 500 status
 */
export function createInternalError(
    messageOrError?: string | Error,
    request?: NextRequest
): NextResponse {
    const error =
        typeof messageOrError === 'string'
            ? new Error(messageOrError)
            : (messageOrError ?? new Error('Internal server error'));

    // Log the full error for debugging (in development/staging)
    if (process.env['NODE_ENV'] !== 'production') {
        // eslint-disable-next-line no-console
        console.error('Internal error:', {
            message: error.message,
            stack: error.stack,
            path: request?.nextUrl?.pathname,
            method: request?.method,
            timestamp: new Date().toISOString(),
        });
    }

    // In production, don't expose internal error details
    const responseMessage =
        process.env['NODE_ENV'] === 'production' ? 'Internal server error' : error.message;

    return createErrorResponse(
        {
            status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
            code: ERROR_CODES.INTERNAL_ERROR,
            message: responseMessage,
        },
        request
    );
}

/**
 * Create a JSON parsing error response
 * @param request - The original request
 * @returns NextResponse with 400 status
 */
export function createJsonParseError(request?: NextRequest): NextResponse {
    return createErrorResponse(
        {
            status: HTTP_STATUS.BAD_REQUEST,
            code: ERROR_CODES.INVALID_JSON,
            message: 'Invalid JSON in request body',
        },
        request
    );
}

/**
 * Create a method not allowed error response
 * @param allowedMethods - Array of allowed HTTP methods
 * @param request - The original request
 * @returns NextResponse with 405 status
 */
export function createMethodNotAllowedError(
    allowedMethods: string[],
    request?: NextRequest
): NextResponse {
    const response = createErrorResponse(
        {
            status: HTTP_STATUS.METHOD_NOT_ALLOWED,
            code: ERROR_CODES.METHOD_NOT_ALLOWED,
            message: 'Method not allowed',
        },
        request
    );

    // Add Allow header
    response.headers.set('Allow', allowedMethods.join(', '));
    return response;
}

/**
 * Create a rate limit exceeded error response
 * @param retryAfter - Seconds until next request is allowed
 * @param request - The original request
 * @returns NextResponse with 429 status
 */
export function createRateLimitError(retryAfter?: number, request?: NextRequest): NextResponse {
    const response = createErrorResponse(
        {
            status: HTTP_STATUS.TOO_MANY_REQUESTS,
            code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
            message: 'Rate limit exceeded',
        },
        request
    );

    if (retryAfter !== undefined && retryAfter !== null && retryAfter > 0) {
        response.headers.set('Retry-After', retryAfter.toString());
    }

    return response;
}

/**
 * Create a bad request error response
 * @param message - Error message
 * @param request - The original request
 * @returns NextResponse with 400 status
 */
export function createBadRequestError(
    message = 'Bad request',
    request?: NextRequest
): NextResponse {
    return createErrorResponse(
        {
            status: HTTP_STATUS.BAD_REQUEST,
            code: 'BAD_REQUEST',
            message,
        },
        request
    );
}

/**
 * Create a not found error response
 * @param resource - Name of the resource that was not found
 * @param request - The original request
 * @returns NextResponse with 404 status
 */
export function createNotFoundError(
    message = 'Resource not found',
    request?: NextRequest
): NextResponse {
    return createErrorResponse(
        {
            status: HTTP_STATUS.NOT_FOUND,
            code: ERROR_CODES.NOT_FOUND,
            message,
        },
        request
    );
}

/**
 * Utility to check if an error is a known application error
 * @param error - Error to check
 * @returns True if it's a known error type
 */
export function isKnownError(error: unknown): error is Error {
    return (
        error instanceof Error &&
        Object.values(ERROR_CODES).includes(error.name as keyof typeof ERROR_CODES)
    );
}

/**
 * Extract meaningful error message from unknown error
 * @param error - Unknown error object
 * @returns Human-readable error message
 */
export function extractErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }

    if (typeof error === 'string') {
        return error;
    }

    if (error !== null && error !== undefined && typeof error === 'object' && 'message' in error) {
        return String(error.message);
    }

    return 'Unknown error occurred';
}

/**
 * Default error handler for unhandled errors in routes
 * @param error - The error that occurred
 * @param request - The original request
 * @returns Appropriate error response
 */
export function handleRouteError(error: unknown, request?: NextRequest): NextResponse {
    // Handle validation errors specifically
    if (error !== null && error !== undefined && typeof error === 'object' && 'issues' in error) {
        // This is likely a Zod error
        const validationErrors: CoreValidationError[] = [
            {
                code: ERROR_CODES.VALIDATION_ERROR,
                message: extractErrorMessage(error),
                path: [],
            },
        ];
        return createValidationError(validationErrors, request);
    }

    // Handle authentication/authorization errors
    if (error instanceof Error) {
        if (error.name === ERROR_CODES.AUTH_REQUIRED) {
            return createAuthError(error.message, request);
        }

        if (error.name === ERROR_CODES.INSUFFICIENT_PERMISSIONS) {
            return createForbiddenError(error.message, request);
        }
    }

    // Default to internal server error
    const errorObj = error instanceof Error ? error : new Error(extractErrorMessage(error));
    return createInternalError(errorObj, request);
}

/**
 * Utility class for creating custom application errors
 */
export class AppError extends Error {
    public statusCode: number;

    constructor(
        message: string,
        public code: string,
        statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR
    ) {
        super(message);
        this.name = code;
        this.statusCode = statusCode;
    }
}

/**
 * Authentication error class
 */
export class AuthenticationError extends AppError {
    constructor(message = 'Authentication required') {
        super(message, ERROR_CODES.AUTHENTICATION_REQUIRED, HTTP_STATUS.UNAUTHORIZED);
        this.name = 'AuthenticationError';
    }

    get status() {
        return this.statusCode;
    }
}

// Alias for backward compatibility
export const AuthError = AuthenticationError;

/**
 * Authorization error class
 */
export class AuthorizationError extends AppError {
    constructor(message = 'Insufficient permissions') {
        super(message, ERROR_CODES.INSUFFICIENT_PERMISSIONS, HTTP_STATUS.FORBIDDEN);
        this.name = 'AuthorizationError';
    }

    get status() {
        return this.statusCode;
    }
}

/**
 * Validation error class
 */
export class ValidationError extends AppError {
    constructor(
        message = 'Validation failed',
        // eslint-disable-next-line no-unused-vars
        public details?: CoreValidationError[]
    ) {
        super(message, ERROR_CODES.VALIDATION_ERROR, HTTP_STATUS.UNPROCESSABLE_ENTITY);
        this.name = 'ValidationError';
    }

    get status() {
        return this.statusCode;
    }
}

/**
 * Internal error class
 */
export class InternalError extends AppError {
    constructor(
        message = 'Internal server error',
        // eslint-disable-next-line no-unused-vars
        public originalError?: Error
    ) {
        super(message, ERROR_CODES.INTERNAL_ERROR, HTTP_STATUS.INTERNAL_SERVER_ERROR);
        this.name = 'InternalError';
    }

    get status() {
        return this.statusCode;
    }
}

// Alias for backward compatibility
export const ValidationAppError = ValidationError;
