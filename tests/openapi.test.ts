import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { OpenAPIConfig, RouteRegistration } from '../src/core/types';
import {
    OpenAPIGenerator,
    createOpenAPIRoute,
    exportOpenAPIJSON,
    generateOpenAPI,
    generateOpenAPIFromRoutes,
} from '../src/openapi/generator';
import {
    clearRoutes,
    exportRegistry,
    getRegistryStats,
    getRoute,
    getRoutes,
    getRoutesGroupedByPath,
    importRegistry,
    registerRoute,
    routeRegistry,
    validateRegistry,
} from '../src/openapi/registry';

describe('OpenAPI System', () => {
    // Test data
    const mockOpenAPIConfig: OpenAPIConfig = {
        title: 'Test API',
        version: '1.0.0',
        description: 'Test API Documentation',
    };

    const mockRoute: RouteRegistration = {
        path: '/api/users',
        method: 'GET',
        config: {
            querySchema: z.object({
                page: z.coerce.number().min(1),
                limit: z.coerce.number().max(100),
            }),
            auth: 'required',
        },
        metadata: {
            summary: 'Get users',
            description: 'Retrieve list of users',
            tags: ['users'],
            operationId: 'getUsers',
        },
    };

    const mockPostRoute: RouteRegistration = {
        path: '/api/users',
        method: 'POST',
        config: {
            bodySchema: z.object({
                name: z.string().min(1),
                email: z.string().email(),
            }),
            responseSchema: z.object({
                id: z.string(),
                name: z.string(),
                email: z.string(),
            }),
            auth: 'required',
        },
        metadata: {
            summary: 'Create user',
            description: 'Create a new user',
            tags: ['users'],
            operationId: 'createUser',
        },
    };

    const mockDynamicRoute: RouteRegistration = {
        path: '/api/users/[id]',
        method: 'GET',
        config: {
            paramsSchema: z.object({
                id: z.string().uuid(),
            }),
            querySchema: z.object({
                include: z.enum(['profile', 'posts']).optional(),
            }),
            responseSchema: z.object({
                id: z.string(),
                name: z.string(),
                email: z.string(),
            }),
            auth: 'required',
        },
        metadata: {
            summary: 'Get user by ID',
            description: 'Retrieve a specific user by ID',
            tags: ['users'],
            operationId: 'getUserById',
        },
    };

    beforeEach(() => {
        clearRoutes();
    });

    afterEach(() => {
        clearRoutes();
    });

    describe('RouteRegistry', () => {
        describe('Route Management', () => {
            it('should register and retrieve routes', () => {
                registerRoute(mockRoute);

                const routes = getRoutes();
                expect(routes).toHaveLength(1);
                expect(routes[0]).toEqual(mockRoute);
            });

            it('should get routes for specific path', () => {
                registerRoute(mockRoute);
                registerRoute(mockPostRoute);

                const routes = routeRegistry.getRoutesForPath('/api/users');
                expect(routes).toHaveLength(2);
                expect(routes.map(r => r.method)).toContain('GET');
                expect(routes.map(r => r.method)).toContain('POST');
            });

            it('should get specific route by path and method', () => {
                registerRoute(mockRoute);

                const route = getRoute('/api/users', 'GET');
                expect(route).toEqual(mockRoute);

                const nonExistentRoute = getRoute('/api/users', 'DELETE');
                expect(nonExistentRoute).toBeUndefined();
            });

            it('should check if route exists', () => {
                registerRoute(mockRoute);

                expect(routeRegistry.hasRoute('/api/users', 'GET')).toBe(true);
                expect(routeRegistry.hasRoute('/api/users', 'POST')).toBe(false);
            });

            it('should unregister routes', () => {
                registerRoute(mockRoute);
                expect(getRoutes()).toHaveLength(1);

                const removed = routeRegistry.unregister('/api/users', 'GET');
                expect(removed).toBe(true);
                expect(getRoutes()).toHaveLength(0);

                const notRemoved = routeRegistry.unregister('/api/users', 'GET');
                expect(notRemoved).toBe(false);
            });

            it('should update routes', () => {
                registerRoute(mockRoute);

                const updatedRoute = {
                    ...mockRoute,
                    metadata: {
                        ...mockRoute.metadata!,
                        summary: 'Updated summary',
                    },
                };

                const updated = routeRegistry.updateRoute('/api/users', 'GET', updatedRoute);
                expect(updated).toBe(true);

                const retrieved = getRoute('/api/users', 'GET');
                expect(retrieved?.metadata?.summary).toBe('Updated summary');
            });

            it('should clear all routes', () => {
                registerRoute(mockRoute);
                registerRoute(mockPostRoute);
                expect(getRoutes()).toHaveLength(2);

                clearRoutes();
                expect(getRoutes()).toHaveLength(0);
            });
        });

        describe('Path Operations', () => {
            it('should get unique paths', () => {
                registerRoute(mockRoute);
                registerRoute(mockPostRoute);
                registerRoute(mockDynamicRoute);

                const paths = routeRegistry.getPaths();
                expect(paths).toContain('/api/users');
                expect(paths).toContain('/api/users/[id]');
                expect(paths).toHaveLength(2);
            });

            it('should get methods for path', () => {
                registerRoute(mockRoute);
                registerRoute(mockPostRoute);

                const methods = routeRegistry.getMethodsForPath('/api/users');
                expect(methods).toContain('GET');
                expect(methods).toContain('POST');
                expect(methods).toHaveLength(2);
            });

            it('should convert Next.js paths to OpenAPI paths', () => {
                const converted = routeRegistry.convertNextPathToOpenAPI('/api/users/[id]');
                expect(converted).toBe('/api/users/{id}');

                const catchAllConverted =
                    routeRegistry.convertNextPathToOpenAPI('/api/posts/[...slug]');
                expect(catchAllConverted).toBe('/api/posts/{slug*}');
            });

            it('should group routes by path', () => {
                registerRoute(mockRoute);
                registerRoute(mockPostRoute);
                registerRoute(mockDynamicRoute);

                const grouped = getRoutesGroupedByPath();
                expect(grouped.size).toBe(2);
                expect(grouped.get('/api/users')).toHaveLength(2);
                expect(grouped.get('/api/users/{id}')).toHaveLength(1);
            });
        });

        describe('Statistics and Validation', () => {
            it('should provide registry statistics', () => {
                registerRoute(mockRoute);
                registerRoute(mockPostRoute);
                registerRoute(mockDynamicRoute);

                const stats = getRegistryStats();
                expect(stats.totalRoutes).toBe(3);
                expect(stats.uniquePaths).toBe(2);
                expect(stats.methodDistribution.GET).toBe(2);
                expect(stats.methodDistribution.POST).toBe(1);
                expect(stats.pathsWithMultipleMethods).toBe(1);
            });

            it('should validate registry consistency', () => {
                registerRoute(mockRoute);

                const issues = validateRegistry();
                expect(issues).toHaveLength(0);

                // Test with invalid route
                const invalidRoute = {
                    path: '',
                    method: 'GET' as const,
                    config: {},
                };
                routeRegistry.register(invalidRoute);

                const issuesAfterInvalid = validateRegistry();
                expect(issuesAfterInvalid.length).toBeGreaterThan(0);
                expect(issuesAfterInvalid[0]).toContain('missing path');
            });

            it('should export and import registry data', () => {
                registerRoute(mockRoute);
                registerRoute(mockPostRoute);

                const exported = exportRegistry();
                expect(exported.routes).toHaveLength(2);
                expect(exported.stats.totalRoutes).toBe(2);
                expect(exported.timestamp).toBeDefined();

                clearRoutes();
                expect(getRoutes()).toHaveLength(0);

                importRegistry({ routes: exported.routes });
                expect(getRoutes()).toHaveLength(2);
            });
        });
    });

    describe('OpenAPIGenerator', () => {
        let generator: OpenAPIGenerator;

        beforeEach(() => {
            generator = new OpenAPIGenerator(mockOpenAPIConfig);
        });

        describe('Basic Spec Generation', () => {
            it('should generate basic OpenAPI specification', () => {
                const spec = generator.generateSpec([mockRoute]);

                expect(spec.openapi).toBe('3.0.3');
                expect(spec.info.title).toBe('Test API');
                expect(spec.info.version).toBe('1.0.0');
                expect(spec.info.description).toBe('Test API Documentation');
                expect(spec.paths).toBeDefined();
            });

            it('should generate paths from routes', () => {
                const spec = generator.generateSpec([mockRoute, mockPostRoute]);

                expect(spec.paths['/api/users']).toBeDefined();
                expect(spec.paths['/api/users']?.get).toBeDefined();
                expect(spec.paths['/api/users']?.post).toBeDefined();
            });

            it('should handle dynamic routes', () => {
                const spec = generator.generateSpec([mockDynamicRoute]);

                expect(spec.paths['/api/users/{id}']).toBeDefined();
                expect(spec.paths['/api/users/{id}']?.parameters).toBeDefined();
                expect(spec.paths['/api/users/{id}']?.parameters?.[0]?.name).toBe('id');
                expect(spec.paths['/api/users/{id}']?.parameters?.[0]?.in).toBe('path');
                expect(spec.paths['/api/users/{id}']?.parameters?.[0]?.required).toBe(true);
            });
        });

        describe('Operation Generation', () => {
            it('should generate operations with metadata', () => {
                const spec = generator.generateSpec([mockRoute]);

                const operation = spec.paths['/api/users']?.get!;
                expect(operation.summary).toBe('Get users');
                expect(operation.description).toBe('Retrieve list of users');
                expect(operation.operationId).toBe('getUsers');
                expect(operation.tags).toContain('users');
            });

            it('should generate query parameters', () => {
                const spec = generator.generateSpec([mockRoute]);

                const operation = spec.paths['/api/users']?.get!;
                expect(operation.parameters).toBeDefined();
                expect(operation.parameters!.length).toBeGreaterThan(0);

                const pageParam = operation.parameters!.find(p => p.name === 'page');
                expect(pageParam).toBeDefined();
                expect(pageParam!.in).toBe('query');
                expect(pageParam!.required).toBe(true);

                const limitParam = operation.parameters!.find(p => p.name === 'limit');
                expect(limitParam).toBeDefined();
                expect(limitParam!.required).toBe(true); // Zod .optional()은 기본적으로 required로 처리됨
            });

            it('should generate request body for POST operations', () => {
                const spec = generator.generateSpec([mockPostRoute]);

                const operation = spec.paths['/api/users']?.post!;
                expect(operation.requestBody).toBeDefined();
                expect(operation.requestBody!.required).toBe(true);
                expect(operation.requestBody!.content['application/json']).toBeDefined();
            });

            it('should generate responses', () => {
                const spec = generator.generateSpec([mockPostRoute]);

                const operation = spec.paths['/api/users']?.post!;
                expect(operation.responses['200']).toBeDefined();
                expect(operation.responses['400']).toBeDefined();
                expect(operation.responses['500']).toBeDefined();
            });

            it('should handle authentication requirements', () => {
                const spec = generator.generateSpec([mockRoute]);

                const operation = spec.paths['/api/users']?.get!;
                expect(operation.security).toContainEqual({ bearerAuth: [] });
                expect(spec.components?.securitySchemes?.['bearerAuth']).toBeDefined();
            });
        });

        describe('Component Generation', () => {
            it('should generate security schemes for authenticated routes', () => {
                const spec = generator.generateSpec([mockRoute]);

                expect(spec.components?.securitySchemes?.['bearerAuth']).toEqual({
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                });
            });

            it('should generate global security for authenticated APIs', () => {
                const spec = generator.generateSpec([mockRoute, mockPostRoute]);

                expect(spec.security).toContainEqual({ bearerAuth: [] });
            });

            it('should generate tags from route metadata', () => {
                const spec = generator.generateSpec([mockRoute, mockPostRoute, mockDynamicRoute]);

                expect(spec.tags).toBeDefined();
                expect(spec.tags!.map(t => t.name)).toContain('users');
            });
        });

        describe('Advanced Features', () => {
            it('should handle multiple response schemas', () => {
                const routeWithMultipleResponses: RouteRegistration = {
                    path: '/api/users',
                    method: 'POST',
                    config: {
                        responseSchemas: {
                            200: z.object({ id: z.string(), name: z.string() }),
                            201: z.object({
                                id: z.string(),
                                name: z.string(),
                                created: z.boolean(),
                            }),
                            400: z.object({ error: z.string() }),
                        },
                    },
                };

                const spec = generator.generateSpec([routeWithMultipleResponses]);
                const operation = spec.paths['/api/users']?.post!;

                expect(operation.responses['200']).toBeDefined();
                expect(operation.responses['201']).toBeDefined();
                expect(operation.responses['400']).toBeDefined();
            });

            it('should handle optional authentication', () => {
                const optionalAuthRoute: RouteRegistration = {
                    path: '/api/public',
                    method: 'GET',
                    config: {
                        auth: 'optional',
                    },
                };

                const spec = generator.generateSpec([optionalAuthRoute]);
                const operation = spec.paths['/api/public']?.get!;

                expect(operation.security).toContainEqual({ bearerAuth: [] });
                expect(operation.security).toContainEqual({});
            });

            it('should handle routes without authentication', () => {
                const publicRoute: RouteRegistration = {
                    path: '/api/public',
                    method: 'GET',
                    config: {
                        auth: false,
                    },
                };

                const spec = generator.generateSpec([publicRoute]);
                const operation = spec.paths['/api/public']?.get!;

                expect(operation.security).toBeUndefined();
            });

            it('should handle complex nested schemas', () => {
                const complexRoute: RouteRegistration = {
                    path: '/api/complex',
                    method: 'POST',
                    config: {
                        bodySchema: z.object({
                            user: z.object({
                                name: z.string(),
                                profile: z.object({
                                    age: z.number(),
                                    interests: z.array(z.string()),
                                }),
                            }),
                            metadata: z.record(z.unknown()),
                        }),
                    },
                };

                const spec = generator.generateSpec([complexRoute]);
                const operation = spec.paths['/api/complex']?.post!;

                expect(operation.requestBody?.content?.['application/json']?.schema).toBeDefined();
            });
        });

        describe('Configuration Options', () => {
            it('should handle config with servers', () => {
                const configWithServers: OpenAPIConfig = {
                    ...mockOpenAPIConfig,
                    servers: [
                        { url: 'https://api.example.com', description: 'Production' },
                        { url: 'https://staging.api.example.com', description: 'Staging' },
                    ],
                };

                const generatorWithServers = new OpenAPIGenerator(configWithServers);
                const spec = generatorWithServers.generateSpec([mockRoute]);

                expect(spec.servers).toHaveLength(2);
                expect(spec.servers?.[0]?.url).toBe('https://api.example.com');
                expect(spec.servers?.[1]?.description).toBe('Staging');
            });

            it('should handle minimal configuration', () => {
                const minimalConfig: OpenAPIConfig = {
                    title: 'Minimal API',
                    version: '1.0.0',
                };

                const minimalGenerator = new OpenAPIGenerator(minimalConfig);
                const spec = minimalGenerator.generateSpec([mockRoute]);

                expect(spec.info.title).toBe('Minimal API');
                expect(spec.info.description).toBeUndefined();
                expect(spec.servers).toBeUndefined();
            });
        });
    });

    describe('Utility Functions', () => {
        beforeEach(() => {
            registerRoute(mockRoute);
            registerRoute(mockPostRoute);
        });

        it('should generate OpenAPI from registry', () => {
            const spec = generateOpenAPI(mockOpenAPIConfig);

            expect(spec.openapi).toBe('3.0.3');
            expect(spec.paths['/api/users']).toBeDefined();
            expect(spec.paths['/api/users']?.get).toBeDefined();
            expect(spec.paths['/api/users']?.post).toBeDefined();
        });

        it('should generate OpenAPI from custom routes', () => {
            const customRoutes = [mockDynamicRoute];
            const spec = generateOpenAPIFromRoutes(mockOpenAPIConfig, customRoutes);

            expect(spec.paths['/api/users/{id}']).toBeDefined();
            expect(spec.paths['/api/users']).toBeUndefined(); // Should not include registry routes
        });

        it('should export OpenAPI as JSON string', () => {
            const json = exportOpenAPIJSON(mockOpenAPIConfig);

            expect(() => JSON.parse(json)).not.toThrow();

            const parsed = JSON.parse(json);
            expect(parsed.openapi).toBe('3.0.3');
            expect(parsed.info.title).toBe('Test API');
        });

        it('should create OpenAPI route handler', () => {
            const routeHandler = createOpenAPIRoute(mockOpenAPIConfig);

            expect(typeof routeHandler).toBe('function');

            // Test the route handler
            const response = routeHandler();
            expect(response).toBeInstanceOf(Response);
            expect(response.headers.get('Content-Type')).toBe('application/json');
            expect(response.headers.get('Cache-Control')).toBe('public, max-age=3600');
        });
    });

    describe('Error Handling', () => {
        it('should handle empty registry gracefully', () => {
            clearRoutes();
            const spec = generateOpenAPI(mockOpenAPIConfig);

            expect(spec.paths).toEqual({});
            expect(spec.components).toBeUndefined();
        });

        it('should handle routes without schemas', () => {
            const minimalRoute: RouteRegistration = {
                path: '/api/minimal',
                method: 'GET',
                config: {},
            };

            const spec = generateOpenAPIFromRoutes(mockOpenAPIConfig, [minimalRoute]);

            expect(spec.paths['/api/minimal']?.get).toBeDefined();
            expect(spec.paths['/api/minimal']?.get?.parameters).toBeUndefined();
            expect(spec.paths['/api/minimal']?.get?.requestBody).toBeUndefined();
        });

        it('should handle routes without metadata', () => {
            const routeWithoutMetadata: RouteRegistration = {
                path: '/api/no-metadata',
                method: 'GET',
                config: {
                    querySchema: z.object({ q: z.string() }),
                },
            };

            const spec = generateOpenAPIFromRoutes(mockOpenAPIConfig, [routeWithoutMetadata]);
            const operation = spec.paths['/api/no-metadata']?.get!;

            expect(operation.summary).toBeUndefined();
            expect(operation.description).toBeUndefined();
            expect(operation.operationId).toBeUndefined();
            expect(operation.tags).toBeUndefined();
        });
    });

    describe('Integration Tests', () => {
        it('should handle complete API scenario', () => {
            // Clear and register a complete set of routes
            clearRoutes();

            const userRoutes: RouteRegistration[] = [
                {
                    path: '/api/users',
                    method: 'GET',
                    config: {
                        querySchema: z.object({
                            page: z.coerce.number().min(1).default(1),
                            limit: z.coerce.number().max(100).default(10),
                            search: z.string().optional(),
                        }),
                        responseSchema: z.object({
                            data: z.array(
                                z.object({
                                    id: z.string(),
                                    name: z.string(),
                                    email: z.string(),
                                })
                            ),
                            meta: z.object({
                                total: z.number(),
                                page: z.number(),
                                limit: z.number(),
                            }),
                        }),
                        auth: 'optional',
                    },
                    metadata: {
                        summary: 'List users',
                        description: 'Get a paginated list of users',
                        tags: ['users'],
                        operationId: 'listUsers',
                    },
                },
                {
                    path: '/api/users',
                    method: 'POST',
                    config: {
                        bodySchema: z.object({
                            name: z.string().min(1).max(100),
                            email: z.string().email(),
                            role: z.enum(['user', 'admin']).default('user'),
                        }),
                        responseSchema: z.object({
                            id: z.string(),
                            name: z.string(),
                            email: z.string(),
                            role: z.string(),
                            createdAt: z.string().datetime(),
                        }),
                        auth: 'required',
                    },
                    metadata: {
                        summary: 'Create user',
                        description: 'Create a new user account',
                        tags: ['users'],
                        operationId: 'createUser',
                    },
                },
                {
                    path: '/api/users/[id]',
                    method: 'GET',
                    config: {
                        paramsSchema: z.object({
                            id: z.string().uuid(),
                        }),
                        responseSchema: z.object({
                            id: z.string(),
                            name: z.string(),
                            email: z.string(),
                            role: z.string(),
                            createdAt: z.string().datetime(),
                            updatedAt: z.string().datetime(),
                        }),
                        responseSchemas: {
                            200: z.object({
                                id: z.string(),
                                name: z.string(),
                                email: z.string(),
                            }),
                            404: z.object({
                                error: z.string(),
                                code: z.string(),
                            }),
                        },
                        auth: 'required',
                    },
                    metadata: {
                        summary: 'Get user',
                        description: 'Get a specific user by ID',
                        tags: ['users'],
                        operationId: 'getUser',
                    },
                },
            ];

            userRoutes.forEach(registerRoute);

            const config: OpenAPIConfig = {
                title: 'User Management API',
                version: '2.0.0',
                description: 'Complete API for managing users',
                servers: [{ url: 'https://api.example.com/v2', description: 'Production' }],
            };

            const spec = generateOpenAPI(config);

            // Verify the complete specification
            expect(spec.info.title).toBe('User Management API');
            expect(spec.servers).toHaveLength(1);
            expect(spec.tags).toContainEqual({ name: 'users' });

            // Verify paths
            expect(spec.paths['/api/users']).toBeDefined();
            expect(spec.paths['/api/users/{id}']).toBeDefined();

            // Verify operations
            expect(spec.paths['/api/users']?.get).toBeDefined();
            expect(spec.paths['/api/users']?.post).toBeDefined();
            expect(spec.paths['/api/users/{id}']?.get).toBeDefined();

            // Verify authentication
            expect(spec.security).toContainEqual({ bearerAuth: [] });
            expect(spec.components?.securitySchemes?.['bearerAuth']).toBeDefined();

            // Verify parameters and schemas are properly generated
            const getUsersOp = spec.paths['/api/users']?.get!;
            expect(getUsersOp?.parameters?.some(p => p.name === 'page')).toBe(true);
            expect(getUsersOp?.parameters?.some(p => p.name === 'limit')).toBe(true);

            const createUserOp = spec.paths['/api/users']?.post!;
            expect(createUserOp?.requestBody?.required).toBe(true);

            const getUserOp = spec.paths['/api/users/{id}']?.get!;
            expect(getUserOp?.responses?.['200']).toBeDefined();
            expect(getUserOp?.responses?.['404']).toBeDefined();
        });
    });
});
