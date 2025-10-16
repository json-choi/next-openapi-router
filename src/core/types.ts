import type { NextRequest, NextResponse } from 'next/server';
import type { ZodSchema } from 'zod';

/**
 * Generic user interface that can be extended for specific authentication providers
 */
export interface GenericUser {
    id: string;
    email?: string;
    name?: string;
    [key: string]: unknown;
}

/**
 * Validation error structure
 */
export interface ValidationError {
    code: string;
    message: string;
    path?: (string | number)[];
    expected?: string;
    received?: unknown;
}

/**
 * Authentication provider interface for different auth solutions
 */
export interface AuthProvider<TUser extends GenericUser = GenericUser> {
    /**
     * Authenticate the current request and return user data
     * @param request - The incoming Next.js request
     * @returns Promise resolving to user data or null if not authenticated
     */
    // eslint-disable-next-line no-unused-vars
    authenticate(request: NextRequest): Promise<TUser | null>;

    /**
     * Optional: Check if the user is authorized for this specific route
     * @param user - The authenticated user
     * @param request - The incoming request
     * @returns Promise resolving to true if authorized
     */
    // eslint-disable-next-line no-unused-vars
    authorize?(user: TUser, request: NextRequest): Promise<boolean>;

    /**
     * Optional: Get user roles or permissions
     * @param user - The authenticated user
     * @returns Array of roles/permissions
     */
    // eslint-disable-next-line no-unused-vars
    getRoles?(user: TUser): string[] | Promise<string[]>;
}

/**
 * OpenAPI metadata for routes
 */
export interface RouteMetadata {
    summary?: string;
    description?: string;
    tags?: string[];
    operationId?: string;
    deprecated?: boolean;
    security?: Array<Record<string, string[]>>;
}

/**
 * OpenAPI configuration
 */
export interface OpenAPIConfig {
    title: string;
    version: string;
    description?: string;
    servers?: Array<{
        url: string;
        description?: string;
    }>;
    basePath?: string;
}

/**
 * Controller configuration interface
 */
export interface ControllerConfig<TUser extends GenericUser = GenericUser> {
    /**
     * Authentication provider instance
     */
    auth?: AuthProvider<TUser>;

    /**
     * Custom handler for authentication errors
     */
    // eslint-disable-next-line no-unused-vars
    onAuthError?: (request: NextRequest) => NextResponse | Promise<NextResponse>;

    /**
     * Custom handler for validation errors
     */
    onValidationError?: (
        // eslint-disable-next-line no-unused-vars
        errors: ValidationError[],
        // eslint-disable-next-line no-unused-vars
        request: NextRequest
    ) => NextResponse | Promise<NextResponse>;

    /**
     * Custom handler for internal errors
     */
    onInternalError?: (
        // eslint-disable-next-line no-unused-vars
        error: Error,
        // eslint-disable-next-line no-unused-vars
        request: NextRequest
    ) => NextResponse | Promise<NextResponse>;

    /**
     * OpenAPI configuration for documentation generation
     */
    openapi?: OpenAPIConfig;

    /**
     * Global middleware to run before all routes
     */
    middleware?: (
        // eslint-disable-next-line no-unused-vars
        request: NextRequest
    ) => Promise<NextRequest | NextResponse> | NextRequest | NextResponse;

    /**
     * Enable response validation in development mode
     */
    validateResponses?: boolean;
}

/**
 * Route-specific configuration
 */
export interface RouteConfig<
    TQuery = unknown,
    TBody = unknown,
    TParams = unknown,
    TResponse = unknown,
> {
    /**
     * Authentication requirement for this route
     * - "required": User must be authenticated
     * - "optional": User may or may not be authenticated
     * - false: No authentication required
     */
    auth?: 'required' | 'optional' | false;

    /**
     * Zod schema for query parameters validation
     */
    querySchema?: ZodSchema<TQuery>;

    /**
     * Zod schema for request body validation
     */
    bodySchema?: ZodSchema<TBody>;

    /**
     * Zod schema for path parameters validation
     */
    paramsSchema?: ZodSchema<TParams>;

    /**
     * Single response schema for successful responses
     */
    responseSchema?: ZodSchema<TResponse>;

    /**
     * Multiple response schemas by HTTP status code
     */
    responseSchemas?: Record<number, ZodSchema<unknown>>;

    /**
     * Enable response validation for this route (overrides global setting)
     */
    validateResponse?: boolean;

    /**
     * OpenAPI metadata for this specific route
     */
    metadata?: RouteMetadata;

    /**
     * Route-specific middleware
     */
    middleware?: (
        // eslint-disable-next-line no-unused-vars
        request: NextRequest
    ) => Promise<NextRequest | NextResponse> | NextRequest | NextResponse;

    /**
     * Required roles/permissions for this route
     */
    roles?: string[];

    /**
     * Rate limiting configuration
     */
    rateLimit?: {
        requests: number;
        window: number; // in seconds
    };
}

/**
 * Context object passed to route handlers
 */
export interface RouteContext<
    TUser extends GenericUser = GenericUser,
    TQuery = unknown,
    TBody = unknown,
    TParams = unknown,
> {
    /**
     * The original Next.js request object
     */
    request: NextRequest;

    /**
     * Authenticated user (if authentication is enabled and successful)
     */
    user?: TUser;

    /**
     * Validated query parameters
     */
    query: TQuery;

    /**
     * Validated request body
     */
    body: TBody;

    /**
     * Validated path parameters
     */
    params: TParams;

    /**
     * User roles/permissions (if available)
     */
    roles?: string[];

    /**
     * Request metadata
     */
    metadata: {
        method: string;
        url: string;
        pathname: string;
        timestamp: Date;
        userAgent?: string;
        ip?: string;
    };
}

/**
 * Route handler function type
 */
export type RouteHandler<
    TUser extends GenericUser = GenericUser,
    TQuery = unknown,
    TBody = unknown,
    TParams = unknown,
    TResponse = unknown,
> = (
    // eslint-disable-next-line no-unused-vars
    context: RouteContext<TUser, TQuery, TBody, TParams>
) => Promise<NextResponse> | NextResponse | Promise<TResponse> | TResponse;

/**
 * HTTP method types supported by Next.js App Router
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

/**
 * Route registration information for OpenAPI generation
 */
export interface RouteRegistration {
    path: string;
    method: HttpMethod;
    config: RouteConfig<unknown, unknown, unknown, unknown>;
    metadata?: RouteMetadata;
}

/**
 * Error response structure
 */
export interface ErrorResponse {
    error: string;
    code: string;
    message: string;
    details?: ValidationError[];
    timestamp: string;
    path: string;
    method: string;
}

/**
 * Standard API response wrapper
 */
export interface ApiResponse<TData = unknown> {
    success: boolean;
    data?: TData;
    error?: ErrorResponse;
    metadata?: {
        timestamp: string;
        requestId?: string;
        version?: string;
    };
}

/**
 * Middleware function type
 */
export type MiddlewareFunction = (
    // eslint-disable-next-line no-unused-vars
    request: NextRequest
) => Promise<NextRequest | NextResponse> | NextRequest | NextResponse;

/**
 * Utility type to extract schema type from Zod schema
 */
export type InferSchema<T> = T extends ZodSchema<infer U> ? U : never;

/**
 * Utility type to make route handler type-safe based on config
 */
export type TypedRouteHandler<
    TConfig extends RouteConfig,
    TUser extends GenericUser = GenericUser,
> = RouteHandler<
    TUser,
    TConfig['querySchema'] extends ZodSchema ? InferSchema<TConfig['querySchema']> : unknown,
    TConfig['bodySchema'] extends ZodSchema ? InferSchema<TConfig['bodySchema']> : unknown,
    TConfig['paramsSchema'] extends ZodSchema ? InferSchema<TConfig['paramsSchema']> : unknown,
    TConfig['responseSchema'] extends ZodSchema ? InferSchema<TConfig['responseSchema']> : unknown
>;
