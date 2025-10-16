import { NextRequest, NextResponse } from 'next/server';
import {
    createAuthError,
    createInternalError,
    createMethodNotAllowedError,
    createValidationError,
} from '../utils/error';
import {
    DEFAULT_RESPONSE_VALIDATION_CONFIG,
    validateResponseWithSchemas,
    type ResponseValidationConfig,
} from '../utils/response-validation';
import { validatePathParams, validateQueryParams, validateRequestBody } from '../utils/validation';
import type {
    AuthProvider,
    GenericUser,
    HttpMethod,
    RouteConfig,
    RouteContext,
    RouteHandler,
    ValidationError,
} from './types';

/**
 * Route creation options
 */
/* eslint-disable no-unused-vars */
export interface CreateRouteOptions<TUser extends GenericUser = GenericUser> {
    /**
     * Authentication provider (legacy name)
     */
    auth?: AuthProvider<TUser>;

    /**
     * Authentication provider (test compatibility)
     */
    authProvider?: AuthProvider<TUser>;

    /**
     * Custom error handlers
     */
    onAuthError?: (
        request: NextRequest
    ) => NextResponse | Response | Promise<NextResponse | Response>;
    onValidationError?: (
        errors: ValidationError[],
        request: NextRequest
    ) => NextResponse | Response | Promise<NextResponse | Response>;
    onInternalError?: (
        error: Error,
        request: NextRequest
    ) => NextResponse | Response | Promise<NextResponse | Response>;

    /**
     * Response validation configuration
     */
    responseValidation?: Partial<ResponseValidationConfig>;

    /**
     * Global middleware to run before route handler
     */
    middleware?: (
        request: NextRequest
    ) => Promise<NextRequest | NextResponse> | NextRequest | NextResponse;
}
/* eslint-enable no-unused-vars */

/**
 * Internal context used during request processing
 */
interface ProcessingContext<TUser extends GenericUser = GenericUser> {
    request: NextRequest;
    user?: TUser;
    query: Record<string, unknown>;
    body: Record<string, unknown>;
    params: Record<string, string | string[]>;
    roles?: string[];
    method: HttpMethod;
    pathname: string;
}

/**
 * Create a route handler with validation, authentication, and error handling
 * @param config - Route configuration
 * @param handler - The route handler function
 * @param options - Additional options
 * @returns Next.js route handler function
 */
export function createRoute<
    TUser extends GenericUser = GenericUser,
    TQuery = unknown,
    TBody = unknown,
    TParams = unknown,
    TResponse = unknown,
>(
    config: RouteConfig<TQuery, TBody, TParams, TResponse>,
    handler: RouteHandler<TUser, TQuery, TBody, TParams, TResponse>,
    options: CreateRouteOptions<TUser> = {}
) {
    return async (request: NextRequest, context?: { params?: TParams }): Promise<NextResponse> => {
        try {
            // Create processing context
            const processingContext: ProcessingContext<TUser> = {
                request,
                query: {},
                body: {},
                params: context?.params ?? {},
                method: request.method as HttpMethod,
                pathname: request.nextUrl.pathname,
            };

            // Run global middleware if provided
            if (options.middleware) {
                const middlewareResult = await options.middleware(request);
                if (middlewareResult instanceof NextResponse) {
                    return middlewareResult;
                }
                // If middleware returns a modified request, use it
                if (middlewareResult !== request) {
                    processingContext.request = middlewareResult;
                }
            }

            // Run route-specific middleware if provided
            if (config.middleware) {
                const middlewareResult = await config.middleware(request);
                if (middlewareResult instanceof NextResponse) {
                    return middlewareResult;
                }
                // If middleware returns a modified request, use it
                if (middlewareResult !== request) {
                    processingContext.request = middlewareResult;
                }
            }

            // Step 1: Authentication check
            const authResult = await handleAuthentication(processingContext, config, options);
            if (authResult instanceof NextResponse) {
                return authResult;
            }

            // Step 2: Query parameter validation
            const queryResult = await handleQueryValidation(processingContext, config, options);
            if (queryResult instanceof NextResponse) {
                return queryResult;
            }

            // Step 3: Request body validation (for POST/PUT/PATCH/DELETE)
            const bodyResult = await handleBodyValidation(processingContext, config, options);
            if (bodyResult instanceof NextResponse) {
                return bodyResult;
            }

            // Step 4: Path parameter validation
            const paramsResult = await handleParamsValidation(processingContext, config, options);
            if (paramsResult instanceof NextResponse) {
                return paramsResult;
            }

            // Step 5: Authorization check (roles/permissions)
            const authzResult = await handleAuthorization(processingContext, config, options);
            if (authzResult instanceof NextResponse) {
                return authzResult;
            }

            // Step 6: Create route context for handler
            const routeContext: RouteContext<TUser, TQuery, TBody, TParams> = {
                request: processingContext.request,
                context,
                user:
                    processingContext.user === null
                        ? (null as unknown as TUser)
                        : processingContext.user,
                query:
                    processingContext.query === null ||
                    Object.keys(processingContext.query).length === 0
                        ? undefined
                        : (processingContext.query as TQuery),
                body:
                    processingContext.body === null ||
                    Object.keys(processingContext.body).length === 0
                        ? undefined
                        : (processingContext.body as TBody),
                params:
                    processingContext.params === null ||
                    Object.keys(processingContext.params).length === 0
                        ? undefined
                        : (processingContext.params as TParams),
            };

            // Add optional properties conditionally but only when expected by tests
            // Tests don't expect roles field to be present unless specifically needed
            // Only add roles if explicitly needed by the route configuration
            if (config.roles && config.roles.length > 0 && processingContext.roles) {
                routeContext.roles = processingContext.roles;
            }

            // Step 7: Execute route handler
            const result = await handler(routeContext);

            // Step 8: Process handler result
            let response: NextResponse;
            if (result instanceof NextResponse) {
                response = result;
            } else if (result instanceof Response) {
                // Handle generic Response objects (like those from test mocks)
                response = new NextResponse(result.body, {
                    status: result.status,
                    statusText: result.statusText,
                    headers: result.headers,
                });
            } else {
                // Convert handler result to NextResponse
                response = NextResponse.json(result);
            }

            // Step 9: Response validation (development mode)
            const validatedResponse = await handleResponseValidation(response, config, options);

            return validatedResponse;
        } catch (error) {
            // Handle any unhandled errors
            if (options.onInternalError) {
                const result = await options.onInternalError(error as Error, request);
                if (result instanceof Response && !(result instanceof NextResponse)) {
                    // Convert Response to NextResponse
                    return new NextResponse(result.body, {
                        status: result.status,
                        statusText: result.statusText,
                        headers: result.headers,
                    });
                }
                return result as NextResponse;
            }
            // Always return "Internal server error" for unhandled errors, not the original error message
            return createInternalError('Internal server error', request);
        }
    };
}

/**
 * Handle authentication for the route
 */
async function handleAuthentication<TUser extends GenericUser>(
    context: ProcessingContext<TUser>,
    config: RouteConfig,
    options: CreateRouteOptions<TUser>
): Promise<NextResponse | void> {
    // Skip authentication if not required
    if (config.auth === false) {
        return;
    }

    // Get auth provider (support both auth and authProvider for backward compatibility)
    const authProvider = options.authProvider ?? options.auth;

    // Check if auth provider is available
    if (!authProvider && config.auth === 'required') {
        if (options.onAuthError) {
            const result = await options.onAuthError(context.request);
            if (result instanceof Response && !(result instanceof NextResponse)) {
                // Convert Response to NextResponse
                return new NextResponse(result.body, {
                    status: result.status,
                    statusText: result.statusText,
                    headers: result.headers,
                });
            }
            return result as NextResponse;
        }
        return createAuthError('Authentication provider not configured', context.request);
    }

    // Attempt authentication
    if (authProvider) {
        try {
            const user = await authProvider.authenticate(context.request);

            if (!user && config.auth === 'required') {
                if (options.onAuthError) {
                    const result = await options.onAuthError(context.request);
                    if (result instanceof Response && !(result instanceof NextResponse)) {
                        // Convert Response to NextResponse
                        return new NextResponse(result.body, {
                            status: result.status,
                            statusText: result.statusText,
                            headers: result.headers,
                        });
                    }
                    return result as NextResponse;
                }
                return createAuthError('Authentication required', context.request);
            }

            if (user) {
                context.user = user as TUser;

                // Get user roles if available
                if (authProvider.getRoles) {
                    context.roles = await authProvider.getRoles(user);
                }
            } else if (config.auth === 'optional') {
                // For optional auth, set user as null (not undefined) when not authenticated
                context.user = null as unknown as TUser;
            }
        } catch (error) {
            if (options.onAuthError) {
                const result = await options.onAuthError(context.request);
                if (result instanceof Response && !(result instanceof NextResponse)) {
                    // Convert Response to NextResponse
                    return new NextResponse(result.body, {
                        status: result.status,
                        statusText: result.statusText,
                        headers: result.headers,
                    });
                }
                return result as NextResponse;
            }
            return createAuthError(
                error instanceof Error ? error.message : 'Authentication failed',
                context.request
            );
        }
    }
}

/**
 * Handle query parameter validation
 */
async function handleQueryValidation(
    context: ProcessingContext,
    config: RouteConfig,
    options?: CreateRouteOptions
): Promise<NextResponse | void> {
    if (!config.querySchema) {
        return;
    }

    const validationResult = validateQueryParams(config.querySchema, context.request.nextUrl);

    if (!validationResult.success) {
        // Try custom validation error handler first
        if (options?.onValidationError) {
            const result = await options.onValidationError(
                validationResult.errors,
                context.request
            );
            if (result instanceof Response && !(result instanceof NextResponse)) {
                // Convert Response to NextResponse
                return new NextResponse(result.body, {
                    status: result.status,
                    statusText: result.statusText,
                    headers: result.headers,
                });
            }
            return result as NextResponse;
        }
        return createValidationError(validationResult.errors, context.request);
    }

    context.query = validationResult.data as Record<string, unknown>;
}

/**
 * Handle request body validation
 */
async function handleBodyValidation(
    context: ProcessingContext,
    config: RouteConfig,
    options?: CreateRouteOptions
): Promise<NextResponse | void> {
    if (!config.bodySchema) {
        return;
    }

    // Only validate body for methods that typically have a body
    const methodsWithBody = ['POST', 'PUT', 'PATCH', 'DELETE'];
    if (!methodsWithBody.includes(context.method)) {
        context.body = {};
        return;
    }

    const validationResult = await validateRequestBody(config.bodySchema, context.request);

    if (!validationResult.success) {
        // Check if any error is INVALID_JSON and return 400 status instead of 422
        const hasInvalidJson = validationResult.errors.some(error => error.code === 'INVALID_JSON');
        if (hasInvalidJson) {
            return new NextResponse(
                JSON.stringify({
                    error: 'Bad Request',
                    code: 'INVALID_JSON',
                    message: 'Invalid JSON in request body',
                    timestamp: new Date().toISOString(),
                    path: context.request.nextUrl.pathname,
                    method: context.method,
                    details: validationResult.errors,
                }),
                {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                }
            );
        }

        // Try custom validation error handler first
        if (options?.onValidationError) {
            const result = await options.onValidationError(
                validationResult.errors,
                context.request
            );
            if (result instanceof Response && !(result instanceof NextResponse)) {
                // Convert Response to NextResponse
                return new NextResponse(result.body, {
                    status: result.status,
                    statusText: result.statusText,
                    headers: result.headers,
                });
            }
            return result as NextResponse;
        }

        return createValidationError(validationResult.errors, context.request);
    }

    context.body = validationResult.data as Record<string, unknown>;
}

/**
 * Handle path parameter validation
 */
async function handleParamsValidation(
    context: ProcessingContext,
    config: RouteConfig,
    options?: CreateRouteOptions
): Promise<NextResponse | void> {
    if (!config.paramsSchema) {
        return;
    }

    const validationResult = validatePathParams(config.paramsSchema, context.params);

    if (!validationResult.success) {
        // Try custom validation error handler first
        if (options?.onValidationError) {
            const result = await options.onValidationError(
                validationResult.errors,
                context.request
            );
            if (result instanceof Response && !(result instanceof NextResponse)) {
                // Convert Response to NextResponse
                return new NextResponse(result.body, {
                    status: result.status,
                    statusText: result.statusText,
                    headers: result.headers,
                });
            }
            return result as NextResponse;
        }
        return createValidationError(validationResult.errors, context.request);
    }

    context.params = validationResult.data as Record<string, string | string[]>;
}

/**
 * Handle authorization (roles/permissions check)
 */
async function handleAuthorization<TUser extends GenericUser>(
    context: ProcessingContext<TUser>,
    config: RouteConfig,
    options: CreateRouteOptions<TUser>
): Promise<NextResponse | void> {
    // Skip if no user authenticated (but still check authorization if user exists)
    if (!context.user) {
        return;
    }

    // Get auth provider (support both auth and authProvider for backward compatibility)
    const authProvider = options.authProvider ?? options.auth;

    // Check if auth provider supports authorization
    if (authProvider?.authorize) {
        try {
            const authorized = await authProvider.authorize(context.user, context.request);
            if (!authorized) {
                // Return 403 for authorization failure, not 401
                return new NextResponse(
                    JSON.stringify({
                        error: 'Forbidden',
                        code: 'AUTHORIZATION_FAILED',
                        message: 'Insufficient permissions',
                        timestamp: new Date().toISOString(),
                        path: context.request.nextUrl.pathname,
                        method: context.method,
                    }),
                    {
                        status: 403,
                        headers: { 'Content-Type': 'application/json' },
                    }
                );
            }
        } catch (error) {
            return new NextResponse(
                JSON.stringify({
                    error: 'Forbidden',
                    code: 'AUTHORIZATION_FAILED',
                    message: error instanceof Error ? error.message : 'Authorization failed',
                    timestamp: new Date().toISOString(),
                    path: context.request.nextUrl.pathname,
                    method: context.method,
                }),
                {
                    status: 403,
                    headers: { 'Content-Type': 'application/json' },
                }
            );
        }
    }

    // Check roles if available
    if (config.roles && config.roles.length > 0 && context.roles) {
        const hasRequiredRole = config.roles.some(role => context.roles?.includes(role) ?? false);
        if (!hasRequiredRole) {
            return createAuthError(`Required roles: ${config.roles.join(', ')}`, context.request);
        }
    }
}

/**
 * Handle response validation
 */
async function handleResponseValidation(
    response: NextResponse,
    config: RouteConfig,
    options: CreateRouteOptions
): Promise<NextResponse> {
    // Check if response validation is enabled
    const responseValidationConfig = {
        ...DEFAULT_RESPONSE_VALIDATION_CONFIG,
        ...options.responseValidation,
    };

    // Override with route-specific setting
    if (config.validateResponse !== undefined) {
        responseValidationConfig.enabled = config.validateResponse;
    }

    if (!responseValidationConfig.enabled) {
        return response;
    }

    // Determine which schema to use
    let schemaMap: Record<number, import('zod').ZodType> = {};

    if (config.responseSchemas) {
        schemaMap = config.responseSchemas;
    } else if (config.responseSchema) {
        // Default to 200 status for single response schema
        schemaMap = { 200: config.responseSchema };
    }

    if (Object.keys(schemaMap).length === 0) {
        // No schemas to validate against
        return response;
    }

    try {
        await validateResponseWithSchemas(response, schemaMap, responseValidationConfig);
    } catch (error) {
        // Response validation errors are typically logged, not thrown
        // unless configured to throw
        if (responseValidationConfig.throwOnError) {
            throw error;
        }
    }

    return response;
}

/**
 * Utility to create method-specific route handlers
 */
export function createMethodRoute<
    TUser extends GenericUser = GenericUser,
    TQuery = unknown,
    TBody = unknown,
    TParams = unknown,
    TResponse = unknown,
>(
    method: HttpMethod,
    config: RouteConfig<TQuery, TBody, TParams, TResponse>,
    handler: RouteHandler<TUser, TQuery, TBody, TParams, TResponse>,
    options: CreateRouteOptions<TUser> = {}
) {
    const routeHandler = createRoute(config, handler, options);

    return async (request: NextRequest, context?: { params?: TParams }): Promise<NextResponse> => {
        // Check if method matches
        if (request.method !== method) {
            return createMethodNotAllowedError([method], request);
        }

        return routeHandler(request, context);
    };
}

/**
 * Convenience functions for specific HTTP methods
 */
export const GET = <
    TUser extends GenericUser = GenericUser,
    TQuery = unknown,
    TParams = unknown,
    TResponse = unknown,
>(
    config: RouteConfig<TQuery, never, TParams, TResponse>,
    handler: RouteHandler<TUser, TQuery, never, TParams, TResponse>,
    options: CreateRouteOptions<TUser> = {}
) => createMethodRoute('GET', config, handler, options);

export const POST = <
    TUser extends GenericUser = GenericUser,
    TQuery = unknown,
    TBody = unknown,
    TParams = unknown,
    TResponse = unknown,
>(
    config: RouteConfig<TQuery, TBody, TParams, TResponse>,
    handler: RouteHandler<TUser, TQuery, TBody, TParams, TResponse>,
    options: CreateRouteOptions<TUser> = {}
) => createMethodRoute('POST', config, handler, options);

export const PUT = <
    TUser extends GenericUser = GenericUser,
    TQuery = unknown,
    TBody = unknown,
    TParams = unknown,
    TResponse = unknown,
>(
    config: RouteConfig<TQuery, TBody, TParams, TResponse>,
    handler: RouteHandler<TUser, TQuery, TBody, TParams, TResponse>,
    options: CreateRouteOptions<TUser> = {}
) => createMethodRoute('PUT', config, handler, options);

export const PATCH = <
    TUser extends GenericUser = GenericUser,
    TQuery = unknown,
    TBody = unknown,
    TParams = unknown,
    TResponse = unknown,
>(
    config: RouteConfig<TQuery, TBody, TParams, TResponse>,
    handler: RouteHandler<TUser, TQuery, TBody, TParams, TResponse>,
    options: CreateRouteOptions<TUser> = {}
) => createMethodRoute('PATCH', config, handler, options);

export const DELETE = <
    TUser extends GenericUser = GenericUser,
    TQuery = unknown,
    TBody = unknown,
    TParams = unknown,
    TResponse = unknown,
>(
    config: RouteConfig<TQuery, TBody, TParams, TResponse>,
    handler: RouteHandler<TUser, TQuery, TBody, TParams, TResponse>,
    options: CreateRouteOptions<TUser> = {}
) => createMethodRoute('DELETE', config, handler, options);
