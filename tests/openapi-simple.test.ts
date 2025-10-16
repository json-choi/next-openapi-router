import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { OpenAPIConfig, RouteRegistration } from '../src/core/types';
import {
    OpenAPIGenerator,
    createOpenAPIRoute,
    exportOpenAPIJSON,
    generateOpenAPI,
} from '../src/openapi/generator';
import {
    clearRoutes,
    getRegistryStats,
    getRoutes,
    registerRoute,
    routeRegistry,
} from '../src/openapi/registry';

describe('OpenAPI System - Simplified', () => {
    const mockConfig: OpenAPIConfig = {
        title: 'Test API',
        version: '1.0.0',
    };

    beforeEach(() => {
        clearRoutes();
    });

    afterEach(() => {
        clearRoutes();
    });

    describe('Registry Basic Functions', () => {
        it('should register and retrieve routes', () => {
            const route: RouteRegistration = {
                path: '/api/test',
                method: 'GET',
                config: {},
            };

            registerRoute(route);
            const routes = getRoutes();

            expect(routes).toHaveLength(1);
            expect(routes[0]).toEqual(route);
        });

        it('should clear routes', () => {
            registerRoute({
                path: '/api/test',
                method: 'GET',
                config: {},
            });

            expect(getRoutes()).toHaveLength(1);
            clearRoutes();
            expect(getRoutes()).toHaveLength(0);
        });

        it('should get registry stats', () => {
            registerRoute({
                path: '/api/users',
                method: 'GET',
                config: {},
            });
            registerRoute({
                path: '/api/users',
                method: 'POST',
                config: {},
            });

            const stats = getRegistryStats();
            expect(stats.totalRoutes).toBe(2);
            expect(stats.uniquePaths).toBe(1);
        });

        it('should convert Next.js paths to OpenAPI paths', () => {
            const converted = routeRegistry.convertNextPathToOpenAPI('/api/users/[id]');
            expect(converted).toBe('/api/users/{id}');

            const catchAllConverted =
                routeRegistry.convertNextPathToOpenAPI('/api/posts/[...slug]');
            expect(catchAllConverted).toBe('/api/posts/{slug*}');
        });
    });

    describe('Generator Basic Functions', () => {
        it('should generate basic OpenAPI spec', () => {
            const route: RouteRegistration = {
                path: '/api/test',
                method: 'GET',
                config: {},
                metadata: {
                    summary: 'Test endpoint',
                },
            };

            const generator = new OpenAPIGenerator(mockConfig);
            const spec = generator.generateSpec([route]);

            expect(spec.openapi).toBe('3.0.3');
            expect(spec.info.title).toBe('Test API');
            expect(spec.info.version).toBe('1.0.0');
            expect(spec.paths['/api/test']).toBeDefined();
        });

        it('should handle routes with schemas', () => {
            const route: RouteRegistration = {
                path: '/api/users',
                method: 'POST',
                config: {
                    bodySchema: z.object({
                        name: z.string(),
                        email: z.string().email(),
                    }),
                    responseSchema: z.object({
                        id: z.string(),
                        name: z.string(),
                        email: z.string(),
                    }),
                },
            };

            const generator = new OpenAPIGenerator(mockConfig);
            const spec = generator.generateSpec([route]);

            expect(spec.paths['/api/users']).toBeDefined();
            const pathItem = spec.paths['/api/users'];
            if (pathItem?.post) {
                expect(pathItem.post.requestBody).toBeDefined();
                expect(pathItem.post.responses['200']).toBeDefined();
            }
        });

        it('should handle authentication', () => {
            const route: RouteRegistration = {
                path: '/api/protected',
                method: 'GET',
                config: {
                    auth: 'required',
                },
            };

            const generator = new OpenAPIGenerator(mockConfig);
            const spec = generator.generateSpec([route]);

            expect(spec.components?.securitySchemes).toBeDefined();
            expect(spec.security).toBeDefined();
        });
    });

    describe('Utility Functions', () => {
        it('should generate OpenAPI from registry', () => {
            registerRoute({
                path: '/api/test',
                method: 'GET',
                config: {},
            });

            const spec = generateOpenAPI(mockConfig);
            expect(spec.paths['/api/test']).toBeDefined();
        });

        it('should export OpenAPI as JSON string', () => {
            registerRoute({
                path: '/api/test',
                method: 'GET',
                config: {},
            });

            const json = exportOpenAPIJSON(mockConfig);
            expect(() => JSON.parse(json)).not.toThrow();

            const parsed = JSON.parse(json);
            expect(parsed.openapi).toBe('3.0.3');
        });

        it('should create OpenAPI route handler', () => {
            const routeHandler = createOpenAPIRoute(mockConfig);
            expect(typeof routeHandler).toBe('function');

            const response = routeHandler();
            expect(response).toBeInstanceOf(Response);
        });
    });

    describe('Path Parameter Handling', () => {
        it('should handle dynamic routes', () => {
            const route: RouteRegistration = {
                path: '/api/users/[id]',
                method: 'GET',
                config: {
                    paramsSchema: z.object({
                        id: z.string(),
                    }),
                },
            };

            const generator = new OpenAPIGenerator(mockConfig);
            const spec = generator.generateSpec([route]);

            expect(spec.paths['/api/users/{id}']).toBeDefined();
            const pathItem = spec.paths['/api/users/{id}'];
            expect(pathItem?.parameters).toBeDefined();
        });
    });

    describe('Response Schema Handling', () => {
        it('should handle multiple response schemas', () => {
            const route: RouteRegistration = {
                path: '/api/users/[id]',
                method: 'GET',
                config: {
                    responseSchemas: {
                        200: z.object({ id: z.string(), name: z.string() }),
                        404: z.object({ error: z.string() }),
                    },
                },
            };

            const generator = new OpenAPIGenerator(mockConfig);
            const spec = generator.generateSpec([route]);

            const pathItem = spec.paths['/api/users/{id}'];
            if (pathItem?.get) {
                expect(pathItem.get.responses['200']).toBeDefined();
                expect(pathItem.get.responses['404']).toBeDefined();
            }
        });
    });
});
