import type { ZodError, ZodIssue, ZodSchema } from 'zod';
import type { ValidationError } from '../core/types';

// Re-export ValidationError for convenience
export type { ValidationError };

/**
 * Result type for validation operations
 */
export type ValidationResult<T> =
    | { success: true; data: T; errors?: never }
    | { success: false; data?: never; errors: ValidationError[] };

/**
 * Validate data against a Zod schema
 * @param schema - The Zod schema to validate against
 * @param data - The data to validate
 * @returns Validation result with typed data or errors
 */
export function validateData<T>(schema: ZodSchema<T>, data: unknown): ValidationResult<T> {
    try {
        const result = schema.safeParse(data);

        if (result.success) {
            return {
                success: true,
                data: result.data,
            };
        }

        return {
            success: false,
            errors: formatZodError(result.error),
        };
    } catch (error) {
        // Handle unexpected errors during validation
        return {
            success: false,
            errors: [
                {
                    code: 'VALIDATION_ERROR',
                    message: error instanceof Error ? error.message : 'Unknown validation error',
                    path: [],
                },
            ],
        };
    }
}

/**
 * Format a Zod error into our standardized ValidationError format
 * @param zodError - The ZodError to format
 * @returns Array of formatted validation errors
 */
export function formatZodError(zodError: ZodError): ValidationError[] {
    return zodError.issues.map((issue: ZodIssue): ValidationError => {
        const baseError: ValidationError = {
            code: issue.code,
            message: issue.message,
            path: issue.path,
        };

        // Add specific details based on error type
        switch (issue.code) {
            case 'invalid_type':
                return {
                    ...baseError,
                    expected: issue.expected,
                    received: issue.received,
                };

            case 'invalid_literal':
                return {
                    ...baseError,
                    expected: String((issue as unknown as { expected: unknown }).expected),
                    received: (issue as unknown as { received: unknown }).received,
                };

            case 'unrecognized_keys':
                return {
                    ...baseError,
                    message: `Unrecognized keys: ${issue.keys?.join(', ') ?? 'unknown'}`,
                };

            case 'invalid_union':
                return {
                    ...baseError,
                    message: `Invalid input. Expected one of: ${
                        (
                            issue as unknown as {
                                unionErrors?: Array<{ issues: Array<{ expected?: string }> }>;
                            }
                        ).unionErrors
                            ?.map(err => err.issues[0]?.expected ?? 'unknown')
                            .join(', ') ?? 'union type'
                    }`,
                };

            case 'invalid_string':
                return {
                    ...baseError,
                    expected: (() => {
                        const validation = (issue as unknown as { validation?: unknown })
                            .validation;
                        return typeof validation === 'string'
                            ? validation
                            : JSON.stringify(validation);
                    })(),
                };

            case 'too_small':
                return {
                    ...baseError,
                    expected: (() => {
                        const tooSmallIssue = issue as unknown as {
                            type?: string;
                            minimum?: number;
                            inclusive?: boolean;
                        };
                        return `${tooSmallIssue.type ?? 'value'} >= ${tooSmallIssue.minimum ?? 0}${tooSmallIssue.inclusive === true ? '' : ' (exclusive)'}`;
                    })(),
                };

            case 'too_big':
                return {
                    ...baseError,
                    expected: (() => {
                        const tooBigIssue = issue as unknown as {
                            type?: string;
                            maximum?: number;
                            inclusive?: boolean;
                        };
                        return `${tooBigIssue.type ?? 'value'} <= ${tooBigIssue.maximum ?? 0}${tooBigIssue.inclusive === true ? '' : ' (exclusive)'}`;
                    })(),
                };

            default:
                return baseError;
        }
    });
}

/**
 * Validate query parameters from URL search params
 * @param schema - Zod schema for query validation
 * @param searchParams - URLSearchParams from request
 * @returns Validation result
 */
export function validateQueryParams<T>(schema: ZodSchema<T>, url: URL): ValidationResult<T> {
    // Convert URLSearchParams to a regular object
    const queryObject: Record<string, string | string[]> = {};
    const searchParams = url.searchParams;

    // Use forEach instead of entries() for better compatibility
    searchParams.forEach((value, key) => {
        if (key in queryObject) {
            // Handle multiple values for the same key
            const existing = queryObject[key];
            if (Array.isArray(existing)) {
                existing.push(value);
            } else {
                queryObject[key] = [existing as string, value];
            }
        } else {
            queryObject[key] = value;
        }
    });

    return validateData(schema, queryObject);
}

/**
 * Validate JSON request body
 * @param schema - Zod schema for body validation
 * @param request - The NextRequest object
 * @returns Promise resolving to validation result
 */
export async function validateRequestBody<T>(
    schema: ZodSchema<T>,
    request: Request
): Promise<ValidationResult<T>> {
    try {
        // Check if body exists
        if (!request.body) {
            return {
                success: false,
                errors: [
                    {
                        code: 'MISSING_BODY',
                        message: 'Request body is required',
                        path: [],
                    },
                ],
            };
        }

        // Check content type
        const contentType = request.headers.get('content-type') ?? '';

        if (!contentType.includes('application/json')) {
            return {
                success: false,
                errors: [
                    {
                        code: 'INVALID_CONTENT_TYPE',
                        message: 'Content-Type must be application/json',
                        path: [],
                        expected: 'application/json',
                        received: contentType,
                    },
                ],
            };
        }

        // Parse JSON body
        const body = await request.json();
        return validateData(schema, body);
    } catch (error) {
        if (error instanceof SyntaxError) {
            return {
                success: false,
                errors: [
                    {
                        code: 'INVALID_JSON',
                        message: 'Invalid JSON in request body',
                        path: [],
                    },
                ],
            };
        }

        return {
            success: false,
            errors: [
                {
                    code: 'BODY_PARSE_ERROR',
                    message:
                        error instanceof Error ? error.message : 'Failed to parse request body',
                    path: [],
                },
            ],
        };
    }
}

/**
 * Validate path parameters
 * @param schema - Zod schema for params validation
 * @param params - Path parameters object
 * @returns Validation result
 */
export function validatePathParams<T>(
    schema: ZodSchema<T>,
    params: Record<string, string | string[]>
): ValidationResult<T> {
    return validateData(schema, params);
}

/**
 * Create a validation error for missing required fields
 * @param fields - Array of missing field names
 * @returns ValidationError array
 */
export function createMissingFieldsError(fields: string[]): ValidationError[] {
    return fields.map(field => ({
        code: 'REQUIRED',
        message: `Field '${field}' is required`,
        path: [field],
    }));
}

/**
 * Combine multiple validation results
 * @param results - Array of validation results
 * @returns Combined validation result
 */
export function combineValidationResults<T extends Record<string, unknown>>(
    results: Array<{ key: keyof T; result: ValidationResult<unknown> }>
): ValidationResult<T> {
    const errors: ValidationError[] = [];
    const data: Partial<T> = {};

    for (const { key, result } of results) {
        if (result.success) {
            (data as Record<string, unknown>)[key as string] = result.data;
        } else {
            // Prefix error paths with the field key
            const prefixedErrors = result.errors.map(error => ({
                ...error,
                path: [key as string, ...(error.path ?? [])],
            }));
            errors.push(...prefixedErrors);
        }
    }

    if (errors.length > 0) {
        return {
            success: false,
            errors,
        };
    }

    return {
        success: true,
        data: data as T,
    };
}

/**
 * Utility to safely access nested object properties
 * @param obj - The object to access
 * @param path - Path array to the property
 * @returns The value at the path or undefined
 */
export function getNestedValue(obj: unknown, path: (string | number)[]): unknown {
    return path.reduce((current: unknown, key: string | number) => {
        return current !== null &&
            current !== undefined &&
            typeof current === 'object' &&
            current !== null
            ? (current as Record<string | number, unknown>)[key]
            : undefined;
    }, obj);
}

/**
 * Check if a value is empty (null, undefined, empty string, empty array, empty object)
 * @param value - Value to check
 * @returns True if the value is considered empty
 */
export function isEmpty(value: unknown): boolean {
    if (value === null || value === undefined) {
        return true;
    }

    if (typeof value === 'string') {
        return value.trim().length === 0;
    }

    if (Array.isArray(value)) {
        return value.length === 0;
    }

    if (typeof value === 'object') {
        return Object.keys(value).length === 0;
    }

    return false;
}
