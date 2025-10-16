import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createController } from '../src/core/create-controller';
import type { AuthProvider, GenericUser } from '../src/core/types';

// Mock user type for testing
interface TestUser extends GenericUser {
    id: string;
    email: string;
    role: string;
}

describe('createController', () => {
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

    describe('Basic Controller Creation', () => {
        it('should create a controller with default configuration', () => {
            const controller = createController();

            expect(controller.get).toBeDefined();
            expect(controller.post).toBeDefined();
            expect(controller.put).toBeDefined();
            expect(controller.patch).toBeDefined();
            expect(controller.delete).toBeDefined();
            expect(typeof controller.get).toBe('function');
            expect(typeof controller.post).toBe('function');
            expect(typeof controller.put).toBe('function');
            expect(typeof controller.patch).toBe('function');
            expect(typeof controller.delete).toBe('function');
        });

        it('should create a controller with auth provider', () => {
            const controller = createController({
                auth: mockAuthProvider,
            });

            expect(controller.get).toBeDefined();
            expect(controller.post).toBeDefined();
            expect(controller.put).toBeDefined();
            expect(controller.patch).toBeDefined();
            expect(controller.delete).toBeDefined();
        });

        it('should create a controller with custom error handlers', () => {
            const onAuthError = vi.fn();
            const onValidationError = vi.fn();
            const onInternalError = vi.fn();

            const controller = createController({
                onAuthError,
                onValidationError,
                onInternalError,
            });

            expect(controller.get).toBeDefined();
            expect(controller.post).toBeDefined();
            expect(controller.put).toBeDefined();
            expect(controller.patch).toBeDefined();
            expect(controller.delete).toBeDefined();
        });
    });

    describe('GET Route Creation', () => {
        it('should create GET route with query validation', async () => {
            const controller = createController();

            const querySchema = z.object({
                page: z.coerce.number().min(1),
                limit: z.coerce.number().max(100).optional(),
            });

            const handler = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [] })));

            const route = controller.get(
                {
                    querySchema,
                },
                handler
            );

            expect(typeof route).toBe('function');

            const request = new NextRequest('https://example.com/api/test?page=1&limit=10');
            await route(request);

            expect(handler).toHaveBeenCalledWith({
                request,
                context: undefined,
                user: undefined,
                query: { page: 1, limit: 10 },
                body: undefined,
                params: undefined,
            });
        });

        it('should create GET route with authentication', async () => {
            const controller = createController({
                auth: mockAuthProvider,
            });

            const handler = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [] })));

            const route = controller.get(
                {
                    auth: 'required',
                },
                handler
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
    });

    describe('POST Route Creation', () => {
        it('should create POST route with body validation', async () => {
            const controller = createController();

            const bodySchema = z.object({
                name: z.string().min(1),
                email: z.string().email(),
            });

            const handler = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: '1' })));

            const route = controller.post(
                {
                    bodySchema,
                },
                handler
            );

            const body = JSON.stringify({
                name: 'John',
                email: 'john@example.com',
            });

            const request = new NextRequest('https://example.com/api/users', {
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

        it('should return validation error for invalid POST body', async () => {
            const controller = createController();

            const bodySchema = z.object({
                email: z.string().email(),
            });

            const handler = vi.fn();

            const route = controller.post(
                {
                    bodySchema,
                },
                handler
            );

            const body = JSON.stringify({
                email: 'invalid-email',
            });

            const request = new NextRequest('https://example.com/api/users', {
                method: 'POST',
                body,
                headers: { 'Content-Type': 'application/json' },
            });

            const response = await route(request);

            expect(response.status).toBe(422);
            expect(handler).not.toHaveBeenCalled();
        });
    });

    describe('PUT Route Creation', () => {
        it('should create PUT route with path and body validation', async () => {
            const controller = createController();

            const paramsSchema = z.object({
                id: z.string().uuid(),
            });

            const bodySchema = z.object({
                name: z.string().min(1),
            });

            const handler = vi
                .fn()
                .mockResolvedValue(new Response(JSON.stringify({ id: '1', name: 'Updated' })));

            const route = controller.put(
                {
                    paramsSchema,
                    bodySchema,
                },
                handler
            );

            const body = JSON.stringify({
                name: 'Updated Name',
            });

            const request = new NextRequest(
                'https://example.com/api/users/123e4567-e89b-12d3-a456-426614174000',
                {
                    method: 'PUT',
                    body,
                    headers: { 'Content-Type': 'application/json' },
                }
            );

            const context = {
                params: {
                    id: '123e4567-e89b-12d3-a456-426614174000',
                },
            };

            await route(request, context);

            expect(handler).toHaveBeenCalledWith({
                request,
                context,
                user: undefined,
                query: undefined,
                body: { name: 'Updated Name' },
                params: { id: '123e4567-e89b-12d3-a456-426614174000' },
            });
        });
    });

    describe('PATCH Route Creation', () => {
        it('should create PATCH route with optional body fields', async () => {
            const controller = createController();

            const bodySchema = z.object({
                name: z.string().min(1).optional(),
                email: z.string().email().optional(),
            });

            const handler = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: '1' })));

            const route = controller.patch(
                {
                    bodySchema,
                },
                handler
            );

            const body = JSON.stringify({
                name: 'Partial Update',
            });

            const request = new NextRequest('https://example.com/api/users/1', {
                method: 'PATCH',
                body,
                headers: { 'Content-Type': 'application/json' },
            });

            await route(request);

            expect(handler).toHaveBeenCalledWith({
                request,
                context: undefined,
                user: undefined,
                query: undefined,
                body: { name: 'Partial Update' },
                params: undefined,
            });
        });
    });

    describe('DELETE Route Creation', () => {
        it('should create DELETE route with path validation', async () => {
            const controller = createController();

            const paramsSchema = z.object({
                id: z.string().uuid(),
            });

            const handler = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));

            const route = controller.delete(
                {
                    paramsSchema,
                },
                handler
            );

            const request = new NextRequest(
                'https://example.com/api/users/123e4567-e89b-12d3-a456-426614174000',
                {
                    method: 'DELETE',
                }
            );

            const context = {
                params: {
                    id: '123e4567-e89b-12d3-a456-426614174000',
                },
            };

            await route(request, context);

            expect(handler).toHaveBeenCalledWith({
                request,
                context,
                user: undefined,
                query: undefined,
                body: undefined,
                params: { id: '123e4567-e89b-12d3-a456-426614174000' },
            });
        });

        it('should create DELETE route with authentication', async () => {
            const controller = createController({
                auth: mockAuthProvider,
            });

            const handler = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));

            const route = controller.delete(
                {
                    auth: 'required',
                },
                handler
            );

            const request = new NextRequest('https://example.com/api/users/1', {
                method: 'DELETE',
            });

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
    });

    describe('Error Handling Integration', () => {
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

            const controller = createController({
                auth: authProvider,
                onAuthError: customAuthErrorHandler,
            });

            const handler = vi.fn();

            const route = controller.get(
                {
                    auth: 'required',
                },
                handler
            );

            const request = new NextRequest('https://example.com/api/protected');
            const response = await route(request);

            expect(customAuthErrorHandler).toHaveBeenCalled();
            expect(response.status).toBe(401);
            expect(handler).not.toHaveBeenCalled();
        });

        it('should use custom validation error handler', async () => {
            const customValidationErrorHandler = vi.fn().mockReturnValue(
                new Response(JSON.stringify({ error: 'Custom validation error' }), {
                    status: 400,
                })
            );

            const controller = createController({
                onValidationError: customValidationErrorHandler,
            });

            const bodySchema = z.object({
                email: z.string().email(),
            });

            const handler = vi.fn();

            const route = controller.post(
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

            expect(customValidationErrorHandler).toHaveBeenCalled();
            expect(response.status).toBe(400);
            expect(handler).not.toHaveBeenCalled();
        });

        it('should use custom internal error handler', async () => {
            const customInternalErrorHandler = vi.fn().mockReturnValue(
                new Response(JSON.stringify({ error: 'Custom internal error' }), {
                    status: 500,
                })
            );

            const controller = createController({
                onInternalError: customInternalErrorHandler,
            });

            const handler = vi.fn().mockRejectedValue(new Error('Handler error'));

            const route = controller.get({}, handler);

            const request = new NextRequest('https://example.com/api/test');
            const response = await route(request);

            expect(customInternalErrorHandler).toHaveBeenCalled();
            expect(response.status).toBe(500);
        });
    });

    describe('Response Schema Validation', () => {
        it('should validate response schema in development mode', async () => {
            // Mock NODE_ENV to development
            const originalEnv = process.env['NODE_ENV'];
            process.env['NODE_ENV'] = 'development';

            const controller = createController();

            const responseSchema = z.object({
                id: z.string(),
                name: z.string(),
            });

            const handler = vi.fn().mockResolvedValue(
                new Response(
                    JSON.stringify({
                        id: '1',
                        name: 'Test',
                    })
                )
            );

            const route = controller.get(
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
    });

    describe('Combined Features', () => {
        it('should handle complex route with all features', async () => {
            const controller = createController({
                auth: mockAuthProvider,
            });

            const querySchema = z.object({
                include: z.enum(['details']).optional(),
            });

            const bodySchema = z.object({
                title: z.string().min(1),
                content: z.string(),
            });

            const paramsSchema = z.object({
                id: z.string().uuid(),
            });

            const responseSchema = z.object({
                id: z.string(),
                title: z.string(),
                content: z.string(),
                authorId: z.string(),
            });

            const handler = vi.fn().mockResolvedValue(
                new Response(
                    JSON.stringify({
                        id: '1',
                        title: 'Test Post',
                        content: 'Test content',
                        authorId: '1',
                    })
                )
            );

            const route = controller.put(
                {
                    querySchema,
                    bodySchema,
                    paramsSchema,
                    responseSchema,
                    auth: 'required',
                    validateResponse: false, // Disable for test
                },
                handler
            );

            const body = JSON.stringify({
                title: 'Test Post',
                content: 'Test content',
            });

            const request = new NextRequest(
                'https://example.com/api/posts/123e4567-e89b-12d3-a456-426614174000?include=details',
                {
                    method: 'PUT',
                    body,
                    headers: { 'Content-Type': 'application/json' },
                }
            );

            const context = {
                params: {
                    id: '123e4567-e89b-12d3-a456-426614174000',
                },
            };

            await route(request, context);

            expect(mockAuthProvider.authenticate).toHaveBeenCalledWith(request);
            expect(handler).toHaveBeenCalledWith({
                request,
                context,
                user: mockUser,
                query: { include: 'details' },
                body: { title: 'Test Post', content: 'Test content' },
                params: { id: '123e4567-e89b-12d3-a456-426614174000' },
            });
        });
    });
});
