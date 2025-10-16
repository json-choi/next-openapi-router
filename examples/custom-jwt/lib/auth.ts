import { NextRequest } from 'next/server';
import type { AuthProvider, GenericUser } from '../../../src';
import { verifyToken } from './jwt';

// User interface for next-router
export interface JWTUser extends GenericUser {
    id: string;
    email: string;
    role: string;
    permissions: string[];
}

// JWT provider for next-router
export const jwtProvider: AuthProvider<JWTUser> = {
    async authenticate(request: NextRequest): Promise<JWTUser | null> {
        try {
            const authHeader = request.headers.get('authorization');
            if (!authHeader?.startsWith('Bearer ')) {
                return null;
            }

            const token = authHeader.slice(7);
            const payload = verifyToken(token);

            if (!payload) {
                return null;
            }

            return {
                id: payload.sub,
                email: payload.email,
                role: payload.role,
                permissions: payload.permissions,
            };
        } catch (error) {
            console.error('JWT authentication error:', error);
            return null;
        }
    },

    async authorize(user: JWTUser, request: NextRequest): Promise<boolean> {
        const url = new URL(request.url);

        // Admin-only routes
        if (url.pathname.startsWith('/api/admin')) {
            return user.role === 'admin';
        }

        // Permission-based routes
        if (url.pathname.startsWith('/api/write')) {
            return user.permissions.includes('write');
        }

        if (url.pathname.startsWith('/api/delete')) {
            return user.permissions.includes('delete');
        }

        // User must be authenticated for protected routes
        return true;
    },

    getRoles(user: JWTUser): string[] {
        const roles = [user.role];

        // Add permissions as roles
        roles.push(...user.permissions);

        return roles;
    },
};
