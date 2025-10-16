import { createClient } from '@supabase/supabase-js';

// Create Supabase client for client-side usage
export const createSupabaseClient = () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    return createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            autoRefreshToken: true,
            persistSession: true,
        },
    });
};

// Create Supabase admin client for server-side usage
export const createSupabaseAdminClient = () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    return createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
};

// Server-side client instance
export const supabaseAdmin = createSupabaseAdminClient();

// Database types
export interface Profile {
    id: string;
    email: string;
    full_name: string | null;
    role: 'admin' | 'user' | 'moderator';
    metadata: Record<string, any>;
    created_at: string;
}

export interface Database {
    public: {
        Tables: {
            profiles: {
                Row: Profile;
                Insert: Omit<Profile, 'id' | 'created_at'>;
                Update: Partial<Omit<Profile, 'id' | 'created_at'>>;
            };
        };
    };
}
