import type { ZodSchema } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { OpenAPIConfig, RouteRegistration } from '../core/types';
import { getRoutesGroupedByPath } from './registry';

/**
 * OpenAPI 3.0.3 specification structure
 */
export interface OpenAPISpec {
    openapi: '3.0.3';
    info: {
        title: string;
        version: string;
        description?: string;
    };
    servers?: Array<{
        url: string;
        description?: string;
    }>;
    paths: Record<string, PathItem>;
    components?: {
        schemas?: Record<string, unknown>;
        securitySchemes?: Record<string, unknown>;
    };
    security?: Array<Record<string, string[]>>;
    tags?: Array<{
        name: string;
        description?: string;
    }>;
}

/**
 * OpenAPI path item structure
 */
export interface PathItem {
    summary?: string;
    description?: string;
    get?: OperationObject;
    post?: OperationObject;
    put?: OperationObject;
    delete?: OperationObject;
    patch?: OperationObject;
    head?: OperationObject;
    options?: OperationObject;
    parameters?: ParameterObject[];
}

/**
 * OpenAPI operation object
 */
export interface OperationObject {
    summary?: string;
    description?: string;
    operationId?: string;
    tags?: string[];
    parameters?: ParameterObject[];
    requestBody?: RequestBodyObject;
    responses: Record<string, ResponseObject>;
    security?: Array<Record<string, string[]>>;
    deprecated?: boolean;
}

/**
 * OpenAPI parameter object
 */
export interface ParameterObject {
    name: string;
    in: 'query' | 'header' | 'path' | 'cookie';
    description?: string;
    required?: boolean;
    deprecated?: boolean;
    schema: unknown;
}

/**
 * OpenAPI request body object
 */
export interface RequestBodyObject {
    description?: string;
    content: Record<string, MediaTypeObject>;
    required?: boolean;
}

/**
 * OpenAPI response object
 */
export interface ResponseObject {
    description: string;
    headers?: Record<string, unknown>;
    content?: Record<string, MediaTypeObject>;
}

/**
 * OpenAPI media type object
 */
export interface MediaTypeObject {
    schema?: unknown;
    examples?: Record<string, unknown>;
}

/**
 * OpenAPI generator class
 */
export class OpenAPIGenerator {
    private readonly config: OpenAPIConfig;
    private components: {
        schemas: Record<string, unknown>;
        securitySchemes: Record<string, unknown>;
    };

    constructor(config: OpenAPIConfig) {
        this.config = config;
        this.components = {
            schemas: {},
            securitySchemes: {},
        };
    }

    /**
     * Generate OpenAPI specification from registered routes
     * @param routes - Optional routes to include (defaults to all registered routes)
     * @returns Complete OpenAPI specification
     */
    generateSpec(routes?: RouteRegistration[]): OpenAPISpec {
        const routesToProcess = routes ?? Array.from(getRoutesGroupedByPath().values()).flat();

        // Reset components for each generation
        this.components = {
            schemas: {},
            securitySchemes: {},
        };

        const spec: OpenAPISpec = {
            openapi: '3.0.3',
            info: {
                title: this.config.title,
                version: this.config.version,
                ...(this.config.description !== undefined &&
                this.config.description !== null &&
                this.config.description !== ''
                    ? { description: this.config.description }
                    : {}),
            },
            paths: this.generatePaths(routesToProcess),
        };

        // Add servers if configured
        if (this.config.servers && this.config.servers.length > 0) {
            spec.servers = this.config.servers;
        }

        // Add components if we have any
        if (
            Object.keys(this.components.schemas).length > 0 ||
            Object.keys(this.components.securitySchemes).length > 0
        ) {
            spec.components = this.components;
        }

        // Add global security if configured
        if (this.hasGlobalAuth(routesToProcess)) {
            this.addDefaultSecurityScheme();
            spec.security = [{ bearerAuth: [] }];
        }

        // Add tags from route metadata
        const tags = this.extractTags(routesToProcess);
        if (tags.length > 0) {
            spec.tags = tags;
        }

        return spec;
    }

    /**
     * Generate paths object from routes
     */
    private generatePaths(routes: RouteRegistration[]): Record<string, PathItem> {
        const pathsMap = new Map<string, RouteRegistration[]>();

        // Group routes by OpenAPI path
        routes.forEach(route => {
            const openApiPath = this.convertNextPathToOpenAPI(route.path);
            if (!pathsMap.has(openApiPath)) {
                pathsMap.set(openApiPath, []);
            }
            const pathRoutes = pathsMap.get(openApiPath);
            if (pathRoutes) {
                pathRoutes.push(route);
            }
        });

        const paths: Record<string, PathItem> = {};

        // Generate path items
        pathsMap.forEach((routeList, path) => {
            paths[path] = this.generatePathItem(routeList, path);
        });

        return paths;
    }

    /**
     * Generate a path item from routes
     */
    private generatePathItem(routes: RouteRegistration[], path: string): PathItem {
        const pathItem: PathItem = {};

        // Extract path parameters for this path
        const pathParameters = this.extractPathParameters(path);
        if (pathParameters.length > 0) {
            pathItem.parameters = pathParameters;
        }

        // Generate operations for each HTTP method
        routes.forEach(route => {
            const operation = this.generateOperation(route);
            const method = route.method.toLowerCase() as keyof PathItem;

            if (method in pathItem) {
                // This should not happen with proper route registration
                // Duplicate method warning - this should not happen with proper route registration
            } else {
                (pathItem as Record<string, unknown>)[method] = operation;
            }
        });

        return pathItem;
    }

    /**
     * Generate an operation object from a route
     */
    private generateOperation(route: RouteRegistration): OperationObject {
        const { config, metadata } = route;
        const operation: OperationObject = {
            responses: this.generateResponses(config.responseSchema, config.responseSchemas),
        };

        // Add metadata if available
        if (metadata) {
            if (metadata.summary !== undefined && metadata.summary !== '')
                operation.summary = metadata.summary;
            if (metadata.description !== undefined && metadata.description !== '')
                operation.description = metadata.description;
            if (metadata.operationId !== undefined && metadata.operationId !== '')
                operation.operationId = metadata.operationId;
            if (metadata.tags) operation.tags = metadata.tags;
            if (metadata.deprecated !== undefined) operation.deprecated = metadata.deprecated;
            if (metadata.security) operation.security = metadata.security;
        }

        // Generate parameters from query and path schemas
        const parameters: ParameterObject[] = [];

        if (config.querySchema) {
            parameters.push(...this.generateQueryParameters(config.querySchema));
        }

        if (parameters.length > 0) {
            operation.parameters = parameters;
        }

        // Generate request body from body schema
        if (config.bodySchema && ['POST', 'PUT', 'PATCH'].includes(route.method)) {
            operation.requestBody = this.generateRequestBody(config.bodySchema);
        }

        // Add authentication requirements
        if (config.auth === 'required') {
            operation.security = operation.security ?? [{ bearerAuth: [] }];
            this.addDefaultSecurityScheme();
        } else if (config.auth === 'optional') {
            operation.security = [{ bearerAuth: [] }, {}];
            this.addDefaultSecurityScheme();
        }

        return operation;
    }

    /**
     * Generate query parameters from Zod schema
     */
    private generateQueryParameters(schema: ZodSchema): ParameterObject[] {
        const jsonSchema = zodToJsonSchema(schema, { target: 'openApi3' }) as Record<
            string,
            unknown
        >;
        const parameters: ParameterObject[] = [];

        if (
            jsonSchema['type'] === 'object' &&
            jsonSchema['properties'] !== undefined &&
            jsonSchema['properties'] !== null &&
            typeof jsonSchema['properties'] === 'object'
        ) {
            Object.entries(jsonSchema['properties'] as Record<string, unknown>).forEach(
                ([name, propSchema]) => {
                    parameters.push({
                        name,
                        in: 'query',
                        required:
                            Array.isArray(jsonSchema['required']) &&
                            (jsonSchema['required'] as string[]).includes(name),
                        schema: propSchema,
                    });
                }
            );
        }

        return parameters;
    }

    /**
     * Generate request body from Zod schema
     */
    private generateRequestBody(schema: ZodSchema): RequestBodyObject {
        const jsonSchema = zodToJsonSchema(schema, { target: 'openApi3' });

        return {
            required: true,
            content: {
                'application/json': {
                    schema: jsonSchema,
                },
            },
        };
    }

    /**
     * Generate responses from schemas
     */
    private generateResponses(
        responseSchema?: ZodSchema,
        responseSchemas?: Record<number, ZodSchema>
    ): Record<string, ResponseObject> {
        const responses: Record<string, ResponseObject> = {};

        // Handle single response schema
        if (responseSchema) {
            const jsonSchema = zodToJsonSchema(responseSchema, { target: 'openApi3' });
            responses['200'] = {
                description: 'Successful response',
                content: {
                    'application/json': {
                        schema: jsonSchema,
                    },
                },
            };
        }

        // Handle multiple response schemas
        if (responseSchemas) {
            Object.entries(responseSchemas).forEach(([statusCode, schema]) => {
                const jsonSchema = zodToJsonSchema(schema, { target: 'openApi3' });
                responses[statusCode] = {
                    description: this.getResponseDescription(parseInt(statusCode)),
                    content: {
                        'application/json': {
                            schema: jsonSchema,
                        },
                    },
                };
            });
        }

        // Add default error responses if none specified
        if (Object.keys(responses).length === 0) {
            responses['200'] = {
                description: 'Successful response',
            };
        }

        // Always add common error responses
        responses['400'] = {
            description: 'Bad Request',
            content: {
                'application/json': {
                    schema: this.getErrorSchema(),
                },
            },
        };

        responses['500'] = {
            description: 'Internal Server Error',
            content: {
                'application/json': {
                    schema: this.getErrorSchema(),
                },
            },
        };

        return responses;
    }

    /**
     * Extract path parameters from OpenAPI path
     */
    private extractPathParameters(path: string): ParameterObject[] {
        const parameters: ParameterObject[] = [];
        const matches = path.matchAll(/\{([^}]+)\}/g);

        for (const match of matches) {
            const paramName = match[1];
            if (paramName !== undefined && paramName !== null && paramName !== '') {
                parameters.push({
                    name: paramName,
                    in: 'path',
                    required: true,
                    schema: {
                        type: 'string',
                    },
                });
            }
        }

        return parameters;
    }

    /**
     * Convert Next.js dynamic route path to OpenAPI path
     */
    private convertNextPathToOpenAPI(nextPath: string): string {
        return nextPath
            .replace(/\[([^\]]+)\]/g, '{$1}') // [id] -> {id}
            .replace(/\[\.\.\.([^\]]+)\]/g, '{$1}'); // [...slug] -> {slug}
    }

    /**
     * Get default error schema
     */
    private getErrorSchema(): Record<string, unknown> {
        return {
            type: 'object',
            properties: {
                error: { type: 'string' },
                code: { type: 'string' },
                message: { type: 'string' },
                details: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            code: { type: 'string' },
                            message: { type: 'string' },
                            path: {
                                type: 'array',
                                items: { oneOf: [{ type: 'string' }, { type: 'number' }] },
                            },
                        },
                    },
                },
                timestamp: { type: 'string', format: 'date-time' },
                path: { type: 'string' },
                method: { type: 'string' },
            },
            required: ['error', 'code', 'message', 'timestamp', 'path', 'method'],
        };
    }

    /**
     * Get response description for status code
     */
    private getResponseDescription(statusCode: number): string {
        const descriptions: Record<number, string> = {
            200: 'Success',
            201: 'Created',
            204: 'No Content',
            400: 'Bad Request',
            401: 'Unauthorized',
            403: 'Forbidden',
            404: 'Not Found',
            422: 'Unprocessable Entity',
            500: 'Internal Server Error',
        };

        return descriptions[statusCode] ?? `HTTP ${statusCode}`;
    }

    /**
     * Check if any routes require authentication
     */
    private hasGlobalAuth(routes: RouteRegistration[]): boolean {
        return routes.some(
            route => route.config.auth === 'required' || route.config.auth === 'optional'
        );
    }

    /**
     * Add default security scheme for bearer authentication
     */
    private addDefaultSecurityScheme(): void {
        this.components.securitySchemes['bearerAuth'] = {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
        };
    }

    /**
     * Extract unique tags from routes
     */
    private extractTags(
        routes: RouteRegistration[]
    ): Array<{ name: string; description?: string }> {
        const tagSet = new Set<string>();

        routes.forEach(route => {
            if (route.metadata?.tags) {
                route.metadata.tags.forEach(tag => tagSet.add(tag));
            }
        });

        return Array.from(tagSet)
            .sort()
            .map(name => ({ name }));
    }
}

/**
 * Generate OpenAPI specification from current registry
 * @param config - OpenAPI configuration
 * @returns Complete OpenAPI specification
 */
export function generateOpenAPI(config: OpenAPIConfig): OpenAPISpec {
    const generator = new OpenAPIGenerator(config);
    return generator.generateSpec();
}

/**
 * Generate OpenAPI specification with custom routes
 * @param config - OpenAPI configuration
 * @param routes - Custom route registrations to include
 * @returns Complete OpenAPI specification
 */
export function generateOpenAPIFromRoutes(
    config: OpenAPIConfig,
    routes: RouteRegistration[]
): OpenAPISpec {
    const generator = new OpenAPIGenerator(config);
    return generator.generateSpec(routes);
}

/**
 * Export OpenAPI specification as JSON string
 * @param config - OpenAPI configuration
 * @returns JSON string representation of the specification
 */
export function exportOpenAPIJSON(config: OpenAPIConfig): string {
    const spec = generateOpenAPI(config);
    return JSON.stringify(spec, null, 2);
}

/**
 * Create a Next.js API route that serves OpenAPI spec
 * @param config - OpenAPI configuration
 * @returns Next.js route handler function
 */
export function createOpenAPIRoute(config: OpenAPIConfig) {
    return function GET() {
        const spec = generateOpenAPI(config);
        return new Response(JSON.stringify(spec, null, 2), {
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
            },
        });
    };
}
