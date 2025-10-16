import { NextResponse } from 'next/server';
import { z } from 'zod';
import { controller } from '../../../lib/controller';

// Schema definitions
const GetUsersQuerySchema = z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(10),
    role: z.enum(['admin', 'user']).optional(),
});

const CreateUserBodySchema = z.object({
    email: z.string().email(),
    name: z.string().min(1),
    role: z.enum(['admin', 'user']).default('user'),
});

const UserResponseSchema = z.object({
    id: z.string(),
    email: z.string(),
    name: z.string(),
    role: z.string(),
    createdAt: z.string(),
});

// Mock data
const mockUsers = [
    {
        id: '1',
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'admin',
        createdAt: new Date().toISOString(),
    },
    {
        id: '2',
        email: 'user@example.com',
        name: 'Regular User',
        role: 'user',
        createdAt: new Date().toISOString(),
    },
];

// GET /api/users - List users (admin only)
export const GET = controller.get(
    {
        querySchema: GetUsersQuerySchema,
        responseSchema: z.object({
            users: z.array(UserResponseSchema),
            totalCount: z.number(),
            page: z.number(),
            limit: z.number(),
        }),
        auth: 'required',
        metadata: {
            summary: 'List users',
            description: 'Get a paginated list of users (admin only)',
            tags: ['Users'],
        },
    },
    async ({ query, user }) => {
        // Check if user is admin
        if (user?.role !== 'admin') {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        const queryData = query || { page: 1, limit: 10 };
        const page = queryData.page || 1;
        const limit = queryData.limit || 10;
        const role = queryData.role;

        let filteredUsers = mockUsers;
        if (role) {
            filteredUsers = mockUsers.filter(u => u.role === role);
        }

        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

        return NextResponse.json({
            users: paginatedUsers,
            totalCount: filteredUsers.length,
            page,
            limit,
        });
    }
);

// POST /api/users - Create new user (admin only)
export const POST = controller.post(
    {
        bodySchema: CreateUserBodySchema,
        responseSchema: UserResponseSchema,
        auth: 'required',
        metadata: {
            summary: 'Create user',
            description: 'Create a new user (admin only)',
            tags: ['Users'],
        },
    },
    async ({ body, user }) => {
        // Check if user is admin
        if (user?.role !== 'admin') {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        // Check if email already exists
        const existingUser = mockUsers.find(u => u.email === body!.email);
        if (existingUser) {
            return NextResponse.json(
                { error: 'User with this email already exists' },
                { status: 409 }
            );
        }

        const newUser = {
            id: crypto.randomUUID(),
            email: body!.email,
            name: body!.name,
            role: body!.role || 'user',
            createdAt: new Date().toISOString(),
        };

        // In real app, save to database
        mockUsers.push(newUser);

        return NextResponse.json(newUser, { status: 201 });
    }
);
