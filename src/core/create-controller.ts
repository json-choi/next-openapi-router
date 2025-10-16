import { NextRequest, NextResponse } from 'next/server';
import { registerRoute } from '../openapi/registry';
import { createMethodRoute, createRoute, type CreateRouteOptions } from './route';
import type {
    ControllerConfig,
    GenericUser,
    HttpMethod,
    RouteConfig,
    RouteHandler,
    RouteRegistration,
} from './types';

/**
 * Controller instance that provides route creation methods
 */
/* eslint-disable no-unused-vars */
export interface Controller<TUser extends GenericUser = GenericUser> {
    /**
     * Create a generic route handler
     */
    route: <TQuery = unknown, TBody = unknown, TParams = unknown, TResponse = unknown>(
        config: RouteConfig<TQuery, TBody, TParams, TResponse>,
        handler: RouteHandler<TUser, TQuery, TBody, TParams, TResponse>
    ) => (request: NextRequest, context?: { params?: TParams }) => Promise<NextResponse>;

    /**
     * Create a GET route handler
     */
    get: <TQuery = unknown, TParams = unknown, TResponse = unknown>(
        config: RouteConfig<TQuery, never, TParams, TResponse>,
        handler: RouteHandler<TUser, TQuery, never, TParams, TResponse>
    ) => (request: NextRequest, context?: { params?: TParams }) => Promise<NextResponse>;

    /**
     * Create a POST route handler
     */
    post: <TQuery = unknown, TBody = unknown, TParams = unknown, TResponse = unknown>(
        config: RouteConfig<TQuery, TBody, TParams, TResponse>,
        handler: RouteHandler<TUser, TQuery, TBody, TParams, TResponse>
    ) => (request: NextRequest, context?: { params?: TParams }) => Promise<NextResponse>;

    /**
     * Create a PUT route handler
     */
    put: <TQuery = unknown, TBody = unknown, TParams = unknown, TResponse = unknown>(
        config: RouteConfig<TQuery, TBody, TParams, TResponse>,
        handler: RouteHandler<TUser, TQuery, TBody, TParams, TResponse>
    ) => (request: NextRequest, context?: { params?: TParams }) => Promise<NextResponse>;

    /**
     * Create a PATCH route handler
     */
    patch: <TQuery = unknown, TBody = unknown, TParams = unknown, TResponse = unknown>(
        config: RouteConfig<TQuery, TBody, TParams, TResponse>,
        handler: RouteHandler<TUser, TQuery, TBody, TParams, TResponse>
    ) => (request: NextRequest, context?: { params?: TParams }) => Promise<NextResponse>;

    /**
     * Create a DELETE route handler
     */
    delete: <TQuery = unknown, TBody = unknown, TParams = unknown, TResponse = unknown>(
        config: RouteConfig<TQuery, TBody, TParams, TResponse>,
        handler: RouteHandler<TUser, TQuery, TBody, TParams, TResponse>
    ) => (request: NextRequest, context?: { params?: TParams }) => Promise<NextResponse>;

    /**
     * Create multiple route handlers for the same endpoint
     */
    routes: (
        routes: Array<{
            method: HttpMethod;
            config: RouteConfig<unknown, unknown, unknown, unknown>;
            handler: RouteHandler<TUser, unknown, unknown, unknown, unknown>;
        }>
    ) => Record<
        HttpMethod,
        (request: NextRequest, context?: { params?: unknown }) => Promise<NextResponse>
    >;

    /**
     * Get the controller configuration
     */
    getConfig: () => ControllerConfig<TUser>;

    /**
     * Update controller configuration
     */
    updateConfig: (config: Partial<ControllerConfig<TUser>>) => void;
}
/* eslint-enable no-unused-vars */

/**
 * Create a controller instance with shared configuration
 * @param config - Controller configuration
 * @returns Controller instance with route creation methods
 */
export function createController<TUser extends GenericUser = GenericUser>(
    config: ControllerConfig<TUser> = {}
): Controller<TUser> {
    // Store the controller configuration
    let controllerConfig: ControllerConfig<TUser> = { ...config };

    // Create route options from controller config
    function getRouteOptions(): CreateRouteOptions<TUser> {
        const options: CreateRouteOptions<TUser> = {
            responseValidation: {
                enabled:
                    controllerConfig.validateResponses ?? process.env['NODE_ENV'] === 'development',
            },
        };

        if (controllerConfig.auth) {
            options.auth = controllerConfig.auth;
        }
        if (controllerConfig.onAuthError) {
            options.onAuthError = controllerConfig.onAuthError;
        }
        if (controllerConfig.onValidationError) {
            options.onValidationError = controllerConfig.onValidationError;
        }
        if (controllerConfig.onInternalError) {
            options.onInternalError = controllerConfig.onInternalError;
        }
        if (controllerConfig.middleware) {
            options.middleware = controllerConfig.middleware;
        }

        return options;
    }

    // Register route for OpenAPI generation if enabled
    function maybeRegisterRoute(
        method: HttpMethod,
        path: string,
        routeConfig: RouteConfig<unknown, unknown, unknown, unknown>
    ): void {
        if (controllerConfig.openapi) {
            const registration: RouteRegistration = {
                path,
                method,
                config: routeConfig,
            };

            if (routeConfig.metadata) {
                registration.metadata = routeConfig.metadata;
            }

            registerRoute(registration);
        }
    }

    // Get current route path from stack trace or other means
    function getCurrentRoutePath(): string {
        // In a real implementation, you might want to:
        // 1. Use Error stack trace analysis
        // 2. Accept path as parameter
        // 3. Use a context provider
        // For now, return a placeholder
        return 'unknown';
    }

    return {
        route<TQuery = unknown, TBody = unknown, TParams = unknown, TResponse = unknown>(
            routeConfig: RouteConfig<TQuery, TBody, TParams, TResponse>,
            handler: RouteHandler<TUser, TQuery, TBody, TParams, TResponse>
        ) {
            const routeHandler = createRoute(routeConfig, handler, getRouteOptions());

            // Register for OpenAPI if enabled
            const path = getCurrentRoutePath();
            maybeRegisterRoute('GET', path, routeConfig); // Default to GET for generic routes

            return routeHandler;
        },

        get<TQuery = unknown, TParams = unknown, TResponse = unknown>(
            routeConfig: RouteConfig<TQuery, never, TParams, TResponse>,
            handler: RouteHandler<TUser, TQuery, never, TParams, TResponse>
        ) {
            const routeHandler = createMethodRoute('GET', routeConfig, handler, getRouteOptions());

            // Register for OpenAPI if enabled
            const path = getCurrentRoutePath();
            maybeRegisterRoute('GET', path, routeConfig);

            return routeHandler;
        },

        post<TQuery = unknown, TBody = unknown, TParams = unknown, TResponse = unknown>(
            routeConfig: RouteConfig<TQuery, TBody, TParams, TResponse>,
            handler: RouteHandler<TUser, TQuery, TBody, TParams, TResponse>
        ) {
            const routeHandler = createMethodRoute('POST', routeConfig, handler, getRouteOptions());

            // Register for OpenAPI if enabled
            const path = getCurrentRoutePath();
            maybeRegisterRoute('POST', path, routeConfig);

            return routeHandler;
        },

        put<TQuery = unknown, TBody = unknown, TParams = unknown, TResponse = unknown>(
            routeConfig: RouteConfig<TQuery, TBody, TParams, TResponse>,
            handler: RouteHandler<TUser, TQuery, TBody, TParams, TResponse>
        ) {
            const routeHandler = createMethodRoute('PUT', routeConfig, handler, getRouteOptions());

            // Register for OpenAPI if enabled
            const path = getCurrentRoutePath();
            maybeRegisterRoute('PUT', path, routeConfig);

            return routeHandler;
        },

        patch<TQuery = unknown, TBody = unknown, TParams = unknown, TResponse = unknown>(
            routeConfig: RouteConfig<TQuery, TBody, TParams, TResponse>,
            handler: RouteHandler<TUser, TQuery, TBody, TParams, TResponse>
        ) {
            const routeHandler = createMethodRoute(
                'PATCH',
                routeConfig,
                handler,
                getRouteOptions()
            );

            // Register for OpenAPI if enabled
            const path = getCurrentRoutePath();
            maybeRegisterRoute('PATCH', path, routeConfig);

            return routeHandler;
        },

        delete<TQuery = unknown, TBody = unknown, TParams = unknown, TResponse = unknown>(
            routeConfig: RouteConfig<TQuery, TBody, TParams, TResponse>,
            handler: RouteHandler<TUser, TQuery, TBody, TParams, TResponse>
        ) {
            const routeHandler = createMethodRoute(
                'DELETE',
                routeConfig,
                handler,
                getRouteOptions()
            );

            // Register for OpenAPI if enabled
            const path = getCurrentRoutePath();
            maybeRegisterRoute('DELETE', path, routeConfig);

            return routeHandler;
        },

        routes(
            routes: Array<{
                method: HttpMethod;
                config: RouteConfig<unknown, unknown, unknown, unknown>;
                handler: RouteHandler<TUser, unknown, unknown, unknown, unknown>;
            }>
        ) {
            const handlers: Partial<
                Record<
                    HttpMethod,
                    (
                        // eslint-disable-next-line no-unused-vars
                        _request: NextRequest,
                        // eslint-disable-next-line no-unused-vars
                        _context?: { params?: unknown }
                    ) => Promise<NextResponse>
                >
            > = {};
            const path = getCurrentRoutePath();

            for (const route of routes) {
                const handler = createMethodRoute(
                    route.method,
                    route.config,
                    route.handler,
                    getRouteOptions()
                );

                handlers[route.method] = handler;

                // Register for OpenAPI if enabled
                maybeRegisterRoute(route.method, path, route.config);
            }

            return handlers as Record<
                HttpMethod,
                // eslint-disable-next-line no-unused-vars
                (_request: NextRequest, _context?: { params?: unknown }) => Promise<NextResponse>
            >;
        },

        getConfig() {
            return { ...controllerConfig };
        },

        updateConfig(newConfig: Partial<ControllerConfig<TUser>>) {
            controllerConfig = { ...controllerConfig, ...newConfig };
        },
    };
}

/**
 * Create a controller with specific authentication provider
 * @param authProvider - Authentication provider instance
 * @param config - Additional controller configuration
 * @returns Controller instance with authentication configured
 */
export function createAuthenticatedController<TUser extends GenericUser = GenericUser>(
    authProvider: ControllerConfig<TUser>['auth'],
    config: Omit<ControllerConfig<TUser>, 'auth'> = {}
): Controller<TUser> {
    const controllerConfig: ControllerConfig<TUser> = { ...config };
    if (authProvider) {
        controllerConfig.auth = authProvider;
    }
    return createController(controllerConfig);
}

/**
 * Create a controller with OpenAPI documentation enabled
 * @param openApiConfig - OpenAPI configuration
 * @param config - Additional controller configuration
 * @returns Controller instance with OpenAPI enabled
 */
export function createDocumentedController<TUser extends GenericUser = GenericUser>(
    openApiConfig: ControllerConfig<TUser>['openapi'],
    config: Omit<ControllerConfig<TUser>, 'openapi'> = {}
): Controller<TUser> {
    const controllerConfig: ControllerConfig<TUser> = { ...config };
    if (openApiConfig) {
        controllerConfig.openapi = openApiConfig;
    }
    return createController(controllerConfig);
}

/**
 * Utility to create a controller for a specific user type
 * This provides better type inference for the user object
 */
export function createTypedController<TUser extends GenericUser>(
    config: ControllerConfig<TUser> = {}
): Controller<TUser> {
    return createController<TUser>(config);
}

/**
 * Default controller instance with no authentication
 * Useful for public APIs or when authentication is handled elsewhere
 */
export const defaultController = createController();

/**
 * Utility to merge multiple controller configurations
 * @param configs - Array of controller configurations to merge
 * @returns Merged configuration
 */
export function mergeControllerConfigs<TUser extends GenericUser = GenericUser>(
    ...configs: Array<Partial<ControllerConfig<TUser>>>
): ControllerConfig<TUser> {
    const merged: ControllerConfig<TUser> = {};

    for (const config of configs) {
        Object.assign(merged, config);
    }

    return merged;
}

/**
 * Utility to create a controller with environment-specific configuration
 * @param environment - Environment name (development, production, test)
 * @param config - Base controller configuration
 * @returns Controller with environment-specific settings
 */
export function createEnvironmentController<TUser extends GenericUser = GenericUser>(
    environment: string,
    config: ControllerConfig<TUser> = {}
): Controller<TUser> {
    const envConfig: Partial<ControllerConfig<TUser>> = {};

    switch (environment) {
        case 'development':
            envConfig.validateResponses = true;
            break;
        case 'production':
            envConfig.validateResponses = false;
            break;
        case 'test':
            envConfig.validateResponses = true;
            break;
    }

    return createController({
        ...config,
        ...envConfig,
    });
}
