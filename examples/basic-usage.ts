import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { AuthProvider, GenericUser } from '../src';
import { createController, createRoute } from '../src';

// Example user type
interface User extends GenericUser {
  id: string;
  email: string;
  role: 'admin' | 'user';
}

// Simple auth provider example
const authProvider: AuthProvider<User> = {
  async authenticate(request: NextRequest): Promise<User | null> {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return null;
    }

    // Mock authentication - in real app, verify JWT/session
    const token = authHeader.slice(7);
    if (token === 'valid-token') {
      return {
        id: '1',
        email: 'user@example.com',
        role: 'user'
      };
    }

    return null;
  },

  async authorize(user: User, request: NextRequest): Promise<boolean> {
    // Example authorization logic
    const url = new URL(request.url);
    if (url.pathname.startsWith('/admin/')) {
      return user.role === 'admin';
    }
    return true;
  },

  getRoles(user: User): string[] {
    return [user.role];
  }
};

// Create controller with auth provider
const controller = createController({
  auth: authProvider,
  onAuthError: () => {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
});

// Define schemas
const GetUserQuerySchema = z.object({
  include: z.enum(['profile', 'posts']).optional(),
  limit: z.coerce.number().min(1).max(100).optional()
});

const CreateUserBodySchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(['admin', 'user']).default('user')
});

const UserParamsSchema = z.object({
  id: z.string().uuid()
});

const UserResponseSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  role: z.string(),
  createdAt: z.string()
});

// Example route handlers

// GET /api/users - List users with optional query params
export const GET = controller.get({
  querySchema: GetUserQuerySchema,
  responseSchema: z.array(UserResponseSchema),
  auth: 'required'
}, async ({ query }) => {
  // Mock data
  const users = [
    {
      id: '1',
      email: 'user@example.com',
      name: 'John Doe',
      role: 'user',
      createdAt: new Date().toISOString()
    }
  ];

  const limit = query?.limit || 10;
  const limitedUsers = users.slice(0, limit);

  return NextResponse.json(limitedUsers);
});

// POST /api/users - Create new user
export const POST = controller.post({
  bodySchema: CreateUserBodySchema,
  responseSchema: UserResponseSchema,
  auth: 'required'
}, async ({ body }) => {
  // Mock user creation
  const newUser = {
    id: crypto.randomUUID(),
    email: body.email,
    name: body.name,
    role: body.role,
    createdAt: new Date().toISOString()
  };

  return NextResponse.json(newUser, { status: 201 });
});

// GET /api/users/[id] - Get user by ID
export const getUserById = createRoute({
  paramsSchema: UserParamsSchema,
  responseSchema: UserResponseSchema,
  auth: 'required'
}, async ({ params }) => {
  // Mock user lookup
  if (params.id === '1') {
    const userData = {
      id: '1',
      email: 'user@example.com',
      name: 'John Doe',
      role: 'user',
      createdAt: new Date().toISOString()
    };

    return NextResponse.json(userData);
  }

  return NextResponse.json({ error: 'User not found' }, { status: 404 });
});

// Example without authentication
export const getPublicData = createRoute({
  querySchema: z.object({
    category: z.string().optional()
  }),
  responseSchema: z.object({
    data: z.array(z.string()),
    count: z.number()
  }),
  auth: false
}, async () => {
  const mockData = ['item1', 'item2', 'item3'];

  return NextResponse.json({
    data: mockData,
    count: mockData.length
  });
});

// Example with validation error handling
export const createPost = controller.post({
  bodySchema: z.object({
    title: z.string().min(5, 'Title must be at least 5 characters'),
    content: z.string().min(10, 'Content must be at least 10 characters'),
    tags: z.array(z.string()).max(5, 'Maximum 5 tags allowed')
  }),
  responseSchema: z.object({
    id: z.string(),
    title: z.string(),
    content: z.string(),
    tags: z.array(z.string()),
    authorId: z.string(),
    createdAt: z.string()
  }),
  auth: 'required'
}, async ({ body, user }) => {
  const post = {
    id: crypto.randomUUID(),
    title: body.title,
    content: body.content,
    tags: body.tags,
    authorId: user?.id || 'unknown',
    createdAt: new Date().toISOString()
  };

  return NextResponse.json(post, { status: 201 });
});
