import { NextRequest } from 'next/server';
import type { AuthProvider, GenericUser } from '../../../src';
import { supabaseAdmin } from './supabase';

// User interface for next-router
export interface SupabaseUser extends GenericUser {
    id: string;
    email: string;
    fullName: string | null;
    role: 'admin' | 'user' | 'moderator';
    metadata: Record<string, any>;
    emailConfirmed: boolean;
    phone: string | null;
    lastSignIn: string | null;
}

// Supabase provider for next-router
export const supabaseProvider: AuthProvider<SupabaseUser> = {
    async authenticate(request: NextRequest): Promise<SupabaseUser | null> {
        try {
            const authHeader = request.headers.get('authorization');
            if (!authHeader?.startsWith('Bearer ')) {
                return null;
            }

            const token = authHeader.slice(7);

            // Verify JWT token
            const {
                data: { user },
                error: userError,
            } = await supabaseAdmin.auth.getUser(token);

            if (userError || !user) {
                console.error('Supabase auth error:', userError);
                return null;
            }

            // Get user profile from profiles table
            const { data: profile, error: profileError } = await supabaseAdmin
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (profileError || !profile) {
                console.error('Profile fetch error:', profileError);
                return null;
            }

            return {
                id: user.id,
                email: user.email!,
                fullName: profile.full_name,
                role: profile.role,
                metadata: profile.metadata || {},
                emailConfirmed: user.email_confirmed_at !== null,
                phone: user.phone,
                lastSignIn: user.last_sign_in_at,
            };
        } catch (error) {
            console.error('Supabase authentication error:', error);
            return null;
        }
    },

    async authorize(user: SupabaseUser, request: NextRequest): Promise<boolean> {
        const url = new URL(request.url);

        // Admin-only routes
        if (url.pathname.startsWith('/api/admin')) {
            return user.role === 'admin';
        }

        // Moderator+ routes
        if (url.pathname.startsWith('/api/moderate')) {
            return ['admin', 'moderator'].includes(user.role);
        }

        // Email confirmation required routes
        if (url.pathname.startsWith('/api/protected')) {
            return user.emailConfirmed;
        }

        // User must be authenticated for protected routes
        return true;
    },

    getRoles(user: SupabaseUser): string[] {
        const roles: string[] = [user.role];

        if (user.metadata.tags && Array.isArray(user.metadata.tags)) {
            roles.push(...user.metadata.tags.map(String));
        }

        if (user.emailConfirmed) {
            roles.push('verified');
        }

        return roles;
    },
};
