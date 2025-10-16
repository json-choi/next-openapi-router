import { getServerSession, NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { NextRequest } from 'next/server';
import type { AuthProvider, GenericUser } from '../../../src';

// Extend the built-in session types
declare module 'next-auth' {
    interface Session {
        user: {
            id: string;
            email: string;
            name: string;
            image?: string;
            role: 'admin' | 'user';
        };
    }

    interface User {
        role: 'admin' | 'user';
    }
}

declare module 'next-auth/jwt' {
    interface JWT {
        role: 'admin' | 'user';
    }
}

// User interface for next-router
export interface User extends GenericUser {
    id: string;
    email: string;
    name: string;
    image?: string;
    role: 'admin' | 'user';
}

// NextAuth configuration
export const authOptions: NextAuthOptions = {
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        }),
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                // Assign default role or get from database
                token.role = user.role || 'user';
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.sub!;
                session.user.role = token.role as 'admin' | 'user';
            }
            return session;
        },
    },
    pages: {
        signIn: '/auth/signin',
        error: '/auth/error',
    },
};

// NextAuth provider for next-router
export const nextAuthProvider: AuthProvider<User> = {
    async authenticate(request: NextRequest): Promise<User | null> {
        try {
            const session = await getServerSession(authOptions);

            if (!session?.user) {
                return null;
            }

            return {
                id: session.user.id,
                email: session.user.email,
                name: session.user.name,
                image: session.user.image,
                role: session.user.role,
            };
        } catch (error) {
            console.error('NextAuth authentication error:', error);
            return null;
        }
    },

    async authorize(user: User, request: NextRequest): Promise<boolean> {
        const url = new URL(request.url);

        // Admin-only routes
        if (url.pathname.startsWith('/api/admin')) {
            return user.role === 'admin';
        }

        // User must be authenticated for protected routes
        return true;
    },

    getRoles(user: User): string[] {
        return [user.role];
    },
};
