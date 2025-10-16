/**
 * next-router: Spring Framework-style route wrapper for Next.js 15 App Router
 *
 * This library provides type-safe routing with authentication, validation,
 * and OpenAPI integration for Next.js 15 App Router.
 */

// Core exports
export {
    createController,
    createAuthenticatedController,
    createDocumentedController,
    createTypedController,
    createEnvironmentController,
    defaultController,
    mergeControllerConfigs,
} from './core/create-controller';

export { createRoute, createMethodRoute, GET, POST, PUT, PATCH, DELETE } from './core/route';

export type { CreateRouteOptions } from './core/route';

// Type exports
export type {
    ControllerConfig,
    RouteConfig,
    RouteContext,
    RouteHandler,
    GenericUser,
    AuthProvider,
    ValidationError,
    ErrorResponse,
    ApiResponse,
    HttpMethod,
    RouteRegistration,
    RouteMetadata,
    OpenAPIConfig,
    MiddlewareFunction,
    InferSchema,
    TypedRouteHandler,
} from './core/types';

export type { Controller } from './core/create-controller';

// Utility exports
export {
    validateData,
    formatZodError,
    validateQueryParams,
    validateRequestBody,
    validatePathParams,
    createMissingFieldsError,
    combineValidationResults,
    getNestedValue,
    isEmpty,
} from './utils/validation';

export type { ValidationResult } from './utils/validation';

export {
    createAuthError,
    createValidationError,
    createInternalError,
    createJsonParseError,
    createMethodNotAllowedError,
    createRateLimitError,
    createBadRequestError,
    createNotFoundError,
    createForbiddenError,
    handleRouteError,
    isKnownError,
    extractErrorMessage,
    AppError,
    AuthError,
    AuthorizationError,
    ValidationAppError,
    HTTP_STATUS,
    ERROR_CODES,
} from './utils/error';

export {
    validateResponse,
    validateResponseWithSchemas,
    addValidationHeaders,
    createValidatedResponse,
    createResponseValidationMiddleware,
    isResponseValidationEnabled,
    getValidationConfigForEnvironment,
    DEFAULT_RESPONSE_VALIDATION_CONFIG,
} from './utils/response-validation';

export type {
    ResponseValidationConfig,
    ResponseValidationResult,
} from './utils/response-validation';

// OpenAPI exports
export {
    routeRegistry,
    registerRoute,
    getRoutes,
    getRoute,
    clearRoutes,
    getRoutesGroupedByPath,
    getRegistryStats,
    exportRegistry,
    importRegistry,
    validateRegistry,
    RouteRegistry,
} from './openapi/registry';

export {
    OpenAPIGenerator,
    generateOpenAPI,
    generateOpenAPIFromRoutes,
    exportOpenAPIJSON,
    createOpenAPIRoute,
} from './openapi/generator';

export type {
    OpenAPISpec,
    PathItem,
    OperationObject,
    ParameterObject,
    RequestBodyObject,
    ResponseObject,
    MediaTypeObject,
} from './openapi/generator';
