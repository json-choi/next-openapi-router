import { auth } from '@clerk/nextjs';
import { NextRequest } from 'next/server';
import type { AuthProvider, GenericUser } from '../../../src';

// User interface for next-router
export interface ClerkUser extends GenericUser {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    imageUrl: string;
    organizationId: string | null;
    organizationRole: string | null;
    publicMetadata: Record<string, any>;
    privateMetadata: Record<string, any>;
}

// Clerk provider for next-router
export const clerkProvider: AuthProvider<ClerkUser> = {
    async authenticate(request: NextRequest): Promise<ClerkUser | null> {
        try {
            const { userId, sessionClaims } = auth();

            if (!userId || !sessionClaims) {
                return null;
            }

            // Extract user data from session claims
            const user: ClerkUser = {
                id: userId,
                email: sessionClaims.email as string,
                firstName: sessionClaims.given_name as string | null,
                lastName: sessionClaims.family_name as string | null,
                imageUrl: sessionClaims.picture as string,
                organizationId: sessionClaims.org_id as string | null,
                organizationRole: sessionClaims.org_role as string | null,
                publicMetadata: sessionClaims.metadata?.public || {},
                privateMetadata: sessionClaims.metadata?.private || {},
            };

            return user;
        } catch (error) {
            console.error('Clerk authentication error:', error);
            return null;
        }
    },

    async authorize(user: ClerkUser, request: NextRequest): Promise<boolean> {
        const url = new URL(request.url);

        // Organization admin-only routes
        if (url.pathname.startsWith('/api/admin')) {
            return user.organizationRole === 'admin';
        }

        // Organization member routes
        if (url.pathname.startsWith('/api/org')) {
            return user.organizationId !== null;
        }

        // Check public metadata for custom roles
        if (url.pathname.startsWith('/api/premium')) {
            return user.publicMetadata.plan === 'premium';
        }

        // User must be authenticated for protected routes
        return true;
    },

    getRoles(user: ClerkUser): string[] {
        const roles: string[] = [];

        if (user.organizationRole) {
            roles.push(user.organizationRole);
        }

        if (user.publicMetadata.role) {
            roles.push(String(user.publicMetadata.role));
        }

        if (user.publicMetadata.plan) {
            roles.push(`plan:${user.publicMetadata.plan}`);
        }

        return roles;
    },
};
