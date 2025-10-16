import { NextResponse } from 'next/server';
import type { ZodSchema } from 'zod';
import type { ValidationError } from '../core/types';
import { validateData } from './validation';

/**
 * Response validation configuration
 */
export interface ResponseValidationConfig {
    /**
     * Enable validation (typically only in development)
     */
    enabled: boolean;

    /**
     * Log validation errors to console
     */
    logErrors: boolean;

    /**
     * Throw errors on validation failure (vs just logging)
     */
    throwOnError: boolean;

    /**
     * Include validation errors in response headers (development only)
     */
    includeErrorsInHeaders: boolean;
}

/**
 * Get default response validation configuration
 * This function evaluates the environment at runtime to ensure proper test behavior
 */
export function getDefaultResponseValidationConfig(): ResponseValidationConfig {
    return {
        enabled: process.env['NODE_ENV'] === 'development',
        logErrors: true,
        throwOnError: false,
        includeErrorsInHeaders: process.env['NODE_ENV'] === 'development',
    };
}

/**
 * Default response validation configuration
 * @deprecated Use getDefaultResponseValidationConfig() instead for runtime evaluation
 */
export const DEFAULT_RESPONSE_VALIDATION_CONFIG: ResponseValidationConfig =
    getDefaultResponseValidationConfig();

/**
 * Result of response validation
 */
export interface ResponseValidationResult {
    valid: boolean;
    errors?: ValidationError[];
    statusCode?: number;
    responseData?: unknown;
}

/**
 * Validate a response against a schema
 * @param response - The NextResponse to validate
 * @param schema - Zod schema for validation
 * @param statusCode - Expected status code (defaults to response status)
 * @returns Promise resolving to validation result
 */
export async function validateResponse(
    response: NextResponse,
    schema: ZodSchema,
    statusCode?: number
): Promise<ResponseValidationResult> {
    try {
        // Check status code if specified
        if (statusCode !== undefined && statusCode !== null && response.status !== statusCode) {
            return {
                valid: false,
                errors: [
                    {
                        code: 'INVALID_STATUS_CODE',
                        message: `Expected status ${statusCode}, got ${response.status}`,
                        path: ['status'],
                        expected: statusCode.toString(),
                        received: response.status,
                    },
                ],
                statusCode: response.status,
            };
        }

        // Clone the response to avoid consuming the body
        const clonedResponse = response.clone();

        // Extract response data
        let responseData: unknown;
        const contentType = clonedResponse.headers.get('content-type') ?? '';

        if (contentType.includes('application/json')) {
            responseData = await clonedResponse.json();
        } else if (contentType.includes('text/')) {
            // For text responses, return valid (gracefully handled)
            return {
                valid: true,
                statusCode: response.status,
                responseData: await clonedResponse.text(),
            };
        } else {
            // For other content types, return valid (gracefully handled)
            return {
                valid: true,
                statusCode: response.status,
                responseData: null,
            };
        }

        // Validate against schema
        const validationResult = validateData(schema, responseData);

        if (validationResult.success) {
            return {
                valid: true,
                statusCode: response.status,
                responseData,
            };
        } else {
            return {
                valid: false,
                errors: validationResult.errors,
                statusCode: response.status,
                responseData,
            };
        }
    } catch (error) {
        return {
            valid: false,
            errors: [
                {
                    code: 'RESPONSE_VALIDATION_ERROR',
                    message: error instanceof Error ? error.message : 'Failed to validate response',
                    path: [],
                },
            ],
            statusCode: response.status,
        };
    }
}

/**
 * Validate a response against multiple schemas based on status code
 * @param response - The NextResponse to validate
 * @param schemaMap - Map of status codes to schemas
 * @param config - Validation configuration
 * @returns Promise resolving to validation result
 */
export async function validateResponseWithSchemas(
    response: NextResponse,
    schemaMap: Record<number, ZodSchema>,
    config: Partial<ResponseValidationConfig> = {}
): Promise<ResponseValidationResult> {
    const finalConfig = { ...getDefaultResponseValidationConfig(), ...config };

    // Skip validation if disabled
    if (!finalConfig.enabled) {
        return { valid: true, statusCode: response.status };
    }

    const schema = schemaMap[response.status];

    if (!schema) {
        const error: ValidationError = {
            code: 'NO_SCHEMA_FOR_STATUS',
            message: `No validation schema found for status code ${response.status}`,
            path: ['status'],
            received: response.status,
            expected: Object.keys(schemaMap).join(', '),
        };

        if (finalConfig.logErrors) {
            // eslint-disable-next-line no-console
            console.warn('Response validation warning:', error);
        }

        // For missing schema, we return valid: false but still continue processing
        return {
            valid: false,
            errors: [error],
            statusCode: response.status,
        };
    }

    const result = await validateResponse(response, schema, response.status);

    // Handle validation result based on configuration
    if (!result.valid && result.errors) {
        if (finalConfig.logErrors) {
            // eslint-disable-next-line no-console
            console.error('Response validation failed:', {
                statusCode: result.statusCode,
                errors: result.errors,
                responseData: result.responseData,
            });
        }

        if (finalConfig.throwOnError) {
            const error = new Error(`Response validation failed: ${result.errors[0]?.message}`);
            error.name = 'ResponseValidationError';
            throw error;
        }
    }

    return result;
}

/**
 * Middleware to add response validation to a NextResponse
 * @param response - The response to enhance
 * @param validationResult - The validation result
 * @param config - Validation configuration
 * @returns Enhanced response with validation headers
 */
export function addValidationHeaders(
    response: NextResponse,
    validationResult: ResponseValidationResult,
    config: Partial<ResponseValidationConfig> = {}
): NextResponse {
    const finalConfig = { ...getDefaultResponseValidationConfig(), ...config };

    if (!finalConfig.includeErrorsInHeaders || !finalConfig.enabled) {
        return response;
    }

    // Add validation status header
    response.headers.set('X-Response-Validation', validationResult.valid ? 'passed' : 'failed');

    // Add validation errors if present (development only)
    if (!validationResult.valid && validationResult.errors) {
        response.headers.set(
            'X-Response-Validation-Errors',
            JSON.stringify(validationResult.errors)
        );
    }

    return response;
}

/**
 * Utility to create a validation-enabled response
 * @param data - Response data
 * @param schema - Validation schema
 * @param options - Response options
 * @returns Promise resolving to validated NextResponse
 */
export async function createValidatedResponse<T>(
    data: T,
    schema: ZodSchema<T>,
    options: {
        status?: number;
        headers?: Record<string, string> | Headers;
        config?: Partial<ResponseValidationConfig>;
    } = {}
): Promise<NextResponse> {
    const HTTP_STATUS_OK = 200;
    const { status = HTTP_STATUS_OK, headers, config } = options;
    const finalConfig = { ...getDefaultResponseValidationConfig(), ...config };

    // Create the response
    const responseInit: { status: number; headers?: Record<string, string> | Headers } = { status };
    if (headers) {
        responseInit.headers = headers;
    }
    const response = NextResponse.json(data, responseInit);

    // Validate if enabled
    if (finalConfig.enabled) {
        const validationResult = await validateResponse(response, schema, status);

        // Add validation headers if configured
        if (finalConfig.includeErrorsInHeaders) {
            addValidationHeaders(response, validationResult, finalConfig);
        }

        // Handle validation failure
        if (!validationResult.valid) {
            if (finalConfig.logErrors) {
                // eslint-disable-next-line no-console
                console.error('Created response failed validation:', {
                    data,
                    errors: validationResult.errors,
                });
            }

            if (finalConfig.throwOnError) {
                throw new Error(
                    `Response validation failed: ${validationResult.errors?.[0]?.message}`
                );
            }
        }
    }

    return response;
}

/**
 * Response validation middleware factory
 * @param schemaMap - Map of status codes to validation schemas
 * @param config - Validation configuration
 * @returns Middleware function
 */
export function createResponseValidationMiddleware(
    schemaMap: Record<number, ZodSchema>,
    config: Partial<ResponseValidationConfig> = {}
) {
    return async (response: NextResponse): Promise<NextResponse> => {
        const validationResult = await validateResponseWithSchemas(response, schemaMap, config);
        return addValidationHeaders(response, validationResult, config);
    };
}

/**
 * Utility to check if response validation is enabled
 * @param config - Optional configuration override
 * @returns True if validation is enabled
 */
export function isResponseValidationEnabled(
    config: Partial<ResponseValidationConfig> = {}
): boolean {
    const finalConfig = { ...getDefaultResponseValidationConfig(), ...config };
    return finalConfig.enabled;
}

/**
 * Get validation configuration based on environment
 * @param environment - Environment name (development, production, test)
 * @returns Validation configuration
 */
export function getValidationConfigForEnvironment(environment: string): ResponseValidationConfig {
    switch (environment) {
        case 'development':
            return {
                enabled: true,
                logErrors: true,
                throwOnError: false,
                includeErrorsInHeaders: true,
            };

        case 'test':
            return {
                enabled: true,
                logErrors: false,
                throwOnError: true,
                includeErrorsInHeaders: false,
            };

        case 'production':
        default:
            return {
                enabled: false,
                logErrors: false,
                throwOnError: false,
                includeErrorsInHeaders: false,
            };
    }
}
