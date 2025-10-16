import { NextResponse } from 'next/server';
import { z } from 'zod';
import { controller } from '../../../lib/controller';

// Schema definitions
const GetUsersQuerySchema = z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(10),
    organizationId: z.string().optional(),
});

const CreateUserBodySchema = z.object({
    email: z.string().email(),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    publicMetadata: z.record(z.any()).optional(),
});

const UserResponseSchema = z.object({
    id: z.string(),
    email: z.string(),
    firstName: z.string().nullable(),
    lastName: z.string().nullable(),
    imageUrl: z.string(),
    organizationId: z.string().nullable(),
    organizationRole: z.string().nullable(),
    publicMetadata: z.record(z.any()),
    createdAt: z.string(),
});

// Mock data
const mockUsers = [
    {
        id: 'user_1',
        email: 'admin@example.com',
        firstName: 'Admin',
        lastName: 'User',
        imageUrl: 'https://img.clerk.com/preview.png',
        organizationId: 'org_1',
        organizationRole: 'admin',
        publicMetadata: { plan: 'premium' },
        createdAt: new Date().toISOString(),
    },
    {
        id: 'user_2',
        email: 'user@example.com',
        firstName: 'Regular',
        lastName: 'User',
        imageUrl: 'https://img.clerk.com/preview.png',
        organizationId: 'org_1',
        organizationRole: 'member',
        publicMetadata: { plan: 'basic' },
        createdAt: new Date().toISOString(),
    },
];

// GET /api/users - List users (organization members)
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
            description: 'Get a paginated list of organization users',
            tags: ['Users', 'Organizations'],
        },
    },
    async ({ query, user }) => {
        const queryData = query || { page: 1, limit: 10 };
        const page = queryData.page || 1;
        const limit = queryData.limit || 10;
        const organizationId = queryData.organizationId || user?.organizationId;

        // Check if user has organization access
        if (!user?.organizationId) {
            return NextResponse.json(
                { error: 'Organization membership required' },
                { status: 403 }
            );
        }

        // Filter users by organization
        let filteredUsers = mockUsers;
        if (organizationId) {
            filteredUsers = mockUsers.filter(u => u.organizationId === organizationId);
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

// POST /api/users - Invite user to organization (admin only)
export const POST = controller.post(
    {
        bodySchema: CreateUserBodySchema,
        responseSchema: UserResponseSchema,
        auth: 'required',
        metadata: {
            summary: 'Invite user',
            description: 'Invite a new user to the organization (admin only)',
            tags: ['Users', 'Organizations'],
        },
    },
    async ({ body, user }) => {
        // Check if user is organization admin
        if (user?.organizationRole !== 'admin') {
            return NextResponse.json(
                { error: 'Organization admin access required' },
                { status: 403 }
            );
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
            id: `user_${crypto.randomUUID()}`,
            email: body!.email,
            firstName: body!.firstName,
            lastName: body!.lastName,
            imageUrl: 'https://img.clerk.com/preview.png',
            organizationId: user!.organizationId || 'org_default',
            organizationRole: 'member',
            publicMetadata: { plan: 'basic', ...body!.publicMetadata },
            createdAt: new Date().toISOString(),
        };

        // In real app, invite user via Clerk API
        mockUsers.push(newUser as any);

        return NextResponse.json(newUser, { status: 201 });
    }
);
