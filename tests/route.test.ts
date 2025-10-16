import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createRoute } from '../src/core/route';
import type { AuthProvider, GenericUser } from '../src/core/types';

// Mock user type for testing
interface TestUser extends GenericUser {
    id: string;
    email: string;
    role: string;
}

describe('createRoute', () => {
    let mockAuthProvider: AuthProvider<TestUser>;
    let mockUser: TestUser;

    beforeEach(() => {
        mockUser = {
            id: '1',
            email: 'test@example.com',
            role: 'user',
        };

        mockAuthProvider = {
            authenticate: vi.fn().mockResolvedValue(mockUser),
            authorize: vi.fn().mockResolvedValue(true),
            getRoles: vi.fn().mockReturnValue(['user']),
        };
    });

    describe('Basic Route Creation', () => {
        it('should create a route without validation or auth', async () => {
            const handler = vi
                .fn()
                .mockResolvedValue(new Response(JSON.stringify({ message: 'success' })));

            const route = createRoute({}, handler);

            const request = new NextRequest('https://example.com/api/test');
            const response = await route(request);

            expect(handler).toHaveBeenCalledWith({
                request,
                context: undefined,
                user: undefined,
                query: undefined,
                body: undefined,
                params: undefined,
            });

            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.message).toBe('success');
        });

        it('should pass through context params', async () => {
            const handler = vi
                .fn()
                .mockResolvedValue(new Response(JSON.stringify({ message: 'success' })));

            const route = createRoute({}, handler);

            const request = new NextRequest('https://example.com/api/test');
            const context = { params: { id: '123' } };

            await route(request, context);

            expect(handler).toHaveBeenCalledWith({
                request,
                context,
                user: undefined,
                query: undefined,
                body: undefined,
                params: { id: '123' },
            });
        });
    });

    describe('Authentication', () => {
        it('should authenticate user when auth is required', async () => {
            const handler = vi
                .fn()
                .mockResolvedValue(new Response(JSON.stringify({ message: 'authenticated' })));

            const route = createRoute(
                {
                    auth: 'required',
                },
                handler,
                {
                    authProvider: mockAuthProvider,
                }
            );

            const request = new NextRequest('https://example.com/api/protected');
            await route(request);

            expect(mockAuthProvider.authenticate).toHaveBeenCalledWith(request);
            expect(handler).toHaveBeenCalledWith({
                request,
                context: undefined,
                user: mockUser,
                query: undefined,
                body: undefined,
                params: undefined,
            });
        });

        it('should return 401 when auth is required but user not authenticated', async () => {
            const handler = vi.fn();

            const authProvider = {
                ...mockAuthProvider,
                authenticate: vi.fn().mockResolvedValue(null),
            };

            const route = createRoute(
                {
                    auth: 'required',
                },
                handler,
                {
                    authProvider,
                }
            );

            const request = new NextRequest('https://example.com/api/protected');
            const response = await route(request);

            expect(response.status).toBe(401);
            expect(handler).not.toHaveBeenCalled();
        });

        it('should handle optional authentication', async () => {
            const handler = vi
                .fn()
                .mockResolvedValue(new Response(JSON.stringify({ message: 'optional auth' })));

            const authProvider = {
                ...mockAuthProvider,
                authenticate: vi.fn().mockResolvedValue(null),
            };

            const route = createRoute(
                {
                    auth: 'optional',
                },
                handler,
                {
                    authProvider,
                }
            );

            const request = new NextRequest('https://example.com/api/optional');
            await route(request);

            expect(handler).toHaveBeenCalledWith({
                request,
                context: undefined,
                user: null,
                query: undefined,
                body: undefined,
                params: undefined,
            });
        });

        it('should skip auth when auth is false', async () => {
            const handler = vi
                .fn()
                .mockResolvedValue(new Response(JSON.stringify({ message: 'no auth' })));

            const route = createRoute(
                {
                    auth: false,
                },
                handler,
                {
                    authProvider: mockAuthProvider,
                }
            );

            const request = new NextRequest('https://example.com/api/public');
            await route(request);

            expect(mockAuthProvider.authenticate).not.toHaveBeenCalled();
            expect(handler).toHaveBeenCalledWith({
                request,
                context: undefined,
                user: undefined,
                query: undefined,
                body: undefined,
                params: undefined,
            });
        });
    });

    describe('Authorization', () => {
        it('should check authorization when provided', async () => {
            const handler = vi
                .fn()
                .mockResolvedValue(new Response(JSON.stringify({ message: 'authorized' })));

            const route = createRoute(
                {
                    auth: 'required',
                },
                handler,
                {
                    authProvider: mockAuthProvider,
                }
            );

            const request = new NextRequest('https://example.com/api/admin');
            await route(request);

            expect(mockAuthProvider.authorize).toHaveBeenCalledWith(mockUser, request);
            expect(handler).toHaveBeenCalled();
        });

        it('should return 403 when authorization fails', async () => {
            const handler = vi.fn();

            const authProvider = {
                ...mockAuthProvider,
                authorize: vi.fn().mockResolvedValue(false),
            };

            const route = createRoute(
                {
                    auth: 'required',
                },
                handler,
                {
                    authProvider,
                }
            );

            const request = new NextRequest('https://example.com/api/admin');
            const response = await route(request);

            expect(response.status).toBe(403);
            expect(handler).not.toHaveBeenCalled();
        });
    });

    describe('Query Parameter Validation', () => {
        it('should validate query parameters', async () => {
            const querySchema = z.object({
                page: z.coerce.number().min(1),
                limit: z.coerce.number().max(100).optional(),
            });

            const handler = vi
                .fn()
                .mockResolvedValue(new Response(JSON.stringify({ message: 'query validated' })));

            const route = createRoute(
                {
                    querySchema,
                },
                handler
            );

            const request = new NextRequest('https://example.com/api/test?page=2&limit=50');
            await route(request);

            expect(handler).toHaveBeenCalledWith({
                request,
                context: undefined,
                user: undefined,
                query: { page: 2, limit: 50 },
                body: undefined,
                params: undefined,
            });
        });

        it('should return 422 for invalid query parameters', async () => {
            const querySchema = z.object({
                page: z.coerce.number().min(1),
            });

            const handler = vi.fn();

            const route = createRoute(
                {
                    querySchema,
                },
                handler
            );

            const request = new NextRequest('https://example.com/api/test?page=0');
            const response = await route(request);

            expect(response.status).toBe(422);
            expect(handler).not.toHaveBeenCalled();
        });
    });

    describe('Request Body Validation', () => {
        it('should validate POST request body', async () => {
            const bodySchema = z.object({
                name: z.string().min(1),
                email: z.string().email(),
            });

            const handler = vi
                .fn()
                .mockResolvedValue(new Response(JSON.stringify({ message: 'body validated' })));

            const route = createRoute(
                {
                    bodySchema,
                },
                handler
            );

            const body = JSON.stringify({
                name: 'John',
                email: 'john@example.com',
            });

            const request = new NextRequest('https://example.com/api/test', {
                method: 'POST',
                body,
                headers: { 'Content-Type': 'application/json' },
            });

            await route(request);

            expect(handler).toHaveBeenCalledWith({
                request,
                context: undefined,
                user: undefined,
                query: undefined,
                body: { name: 'John', email: 'john@example.com' },
                params: undefined,
            });
        });

        it('should return 422 for invalid request body', async () => {
            const bodySchema = z.object({
                email: z.string().email(),
            });

            const handler = vi.fn();

            const route = createRoute(
                {
                    bodySchema,
                },
                handler
            );

            const body = JSON.stringify({
                email: 'invalid-email',
            });

            const request = new NextRequest('https://example.com/api/test', {
                method: 'POST',
                body,
                headers: { 'Content-Type': 'application/json' },
            });

            const response = await route(request);

            expect(response.status).toBe(422);
            expect(handler).not.toHaveBeenCalled();
        });

        it('should return 400 for invalid JSON', async () => {
            const bodySchema = z.object({
                name: z.string(),
            });

            const handler = vi.fn();

            const route = createRoute(
                {
                    bodySchema,
                },
                handler
            );

            const request = new NextRequest('https://example.com/api/test', {
                method: 'POST',
                body: '{ invalid json',
                headers: { 'Content-Type': 'application/json' },
            });

            const response = await route(request);

            expect(response.status).toBe(400);
            expect(handler).not.toHaveBeenCalled();
        });
    });

    describe('Path Parameter Validation', () => {
        it('should validate path parameters', async () => {
            const paramsSchema = z.object({
                id: z.string().uuid(),
                slug: z.string().min(1),
            });

            const handler = vi
                .fn()
                .mockResolvedValue(new Response(JSON.stringify({ message: 'params validated' })));

            const route = createRoute(
                {
                    paramsSchema,
                },
                handler
            );

            const request = new NextRequest('https://example.com/api/test');
            const context = {
                params: {
                    id: '123e4567-e89b-12d3-a456-426614174000',
                    slug: 'test-slug',
                },
            };

            await route(request, context);

            expect(handler).toHaveBeenCalledWith({
                request,
                context,
                user: undefined,
                query: undefined,
                body: undefined,
                params: context.params,
            });
        });

        it('should return 422 for invalid path parameters', async () => {
            const paramsSchema = z.object({
                id: z.string().uuid(),
            });

            const handler = vi.fn();

            const route = createRoute(
                {
                    paramsSchema,
                },
                handler
            );

            const request = new NextRequest('https://example.com/api/test');
            const context = {
                params: {
                    id: 'invalid-uuid',
                },
            };

            const response = await route(request, context);

            expect(response.status).toBe(422);
            expect(handler).not.toHaveBeenCalled();
        });
    });

    describe('Error Handling', () => {
        it('should handle handler errors gracefully', async () => {
            const handler = vi.fn().mockRejectedValue(new Error('Handler error'));

            const route = createRoute({}, handler);

            const request = new NextRequest('https://example.com/api/test');
            const response = await route(request);

            expect(response.status).toBe(500);

            const body = await response.json();
            expect(body.error).toBe('Internal server error');
        });

        it('should use custom error handlers when provided', async () => {
            const customErrorHandler = vi
                .fn()
                .mockReturnValue(
                    new Response(JSON.stringify({ error: 'Custom error' }), { status: 500 })
                );

            const handler = vi.fn().mockRejectedValue(new Error('Handler error'));

            const route = createRoute({}, handler, {
                onInternalError: customErrorHandler,
            });

            const request = new NextRequest('https://example.com/api/test');
            const response = await route(request);

            expect(customErrorHandler).toHaveBeenCalled();
            expect(response.status).toBe(500);
        });

        it('should use custom auth error handler', async () => {
            const customAuthErrorHandler = vi
                .fn()
                .mockReturnValue(
                    new Response(JSON.stringify({ error: 'Custom auth error' }), { status: 401 })
                );

            const authProvider = {
                ...mockAuthProvider,
                authenticate: vi.fn().mockResolvedValue(null),
            };

            const handler = vi.fn();

            const route = createRoute(
                {
                    auth: 'required',
                },
                handler,
                {
                    authProvider,
                    onAuthError: customAuthErrorHandler,
                }
            );

            const request = new NextRequest('https://example.com/api/protected');
            const response = await route(request);

            expect(customAuthErrorHandler).toHaveBeenCalled();
            expect(response.status).toBe(401);
        });
    });

    describe('Response Validation', () => {
        it('should validate response in development mode', async () => {
            // Mock NODE_ENV to development
            const originalEnv = process.env['NODE_ENV'];
            process.env['NODE_ENV'] = 'development';

            const responseSchema = z.object({
                message: z.string(),
                data: z.object({
                    id: z.string(),
                }),
            });

            const handler = vi.fn().mockResolvedValue(
                new Response(
                    JSON.stringify({
                        message: 'success',
                        data: { id: '123' },
                    })
                )
            );

            const route = createRoute(
                {
                    responseSchema,
                    validateResponse: true,
                },
                handler
            );

            const request = new NextRequest('https://example.com/api/test');
            const response = await route(request);

            expect(response.status).toBe(200);

            // Restore NODE_ENV
            process.env['NODE_ENV'] = originalEnv;
        });

        it('should skip response validation in production', async () => {
            // Mock NODE_ENV to production
            const originalEnv = process.env['NODE_ENV'];
            process.env['NODE_ENV'] = 'production';

            const responseSchema = z.object({
                message: z.string(),
            });

            // Return invalid response that would fail validation
            const handler = vi
                .fn()
                .mockResolvedValue(new Response(JSON.stringify({ invalid: 'response' })));

            const route = createRoute(
                {
                    responseSchema,
                    validateResponse: true,
                },
                handler
            );

            const request = new NextRequest('https://example.com/api/test');
            const response = await route(request);

            // Should still return the response without validation
            expect(response.status).toBe(200);

            // Restore NODE_ENV
            process.env['NODE_ENV'] = originalEnv;
        });
    });
});
