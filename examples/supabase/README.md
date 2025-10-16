# Supabase Auth Integration Example

이 예제는 `next-router`를 Supabase Auth와 함께 사용하는 방법을 보여줍니다.

## Setup

1. 의존성 설치:
```bash
npm install @supabase/supabase-js
```

2. 환경변수 설정 (`.env.local`):
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret
```

3. Supabase 설정 (`lib/supabase.ts` 참조)

4. API routes 사용 (`app/api/users/route.ts`, `app/api/posts/route.ts` 참조)

## Features

- Supabase Auth JWT 토큰 검증
- Row Level Security (RLS) 지원
- 사용자 메타데이터 접근
- 역할 기반 접근 제어
- Real-time subscriptions 준비

## File Structure

```
examples/supabase/
├── README.md
├── package.json
├── .env.local.example
├── app/
│   └── api/
│       ├── users/
│       │   └── route.ts
│       └── posts/
│           └── route.ts
└── lib/
    ├── auth.ts
    ├── controller.ts
    └── supabase.ts
```

## Usage

```typescript
// lib/controller.ts
import { createController } from 'next-router';
import { supabaseProvider } from './auth';

const controller = createController({
  auth: supabaseProvider
});

// API route
export const GET = controller.get({
  auth: 'required',
  responseSchema: UserSchema
}, async ({ user }) => {
  return NextResponse.json({ user });
});
```

## Database Schema

Supabase에서 다음과 같은 테이블 구조를 사용합니다:

```sql
-- User profiles table
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user', 'moderator')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own profile"
ON profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON profiles FOR UPDATE
USING (auth.uid() = id);
```

## Auth Hooks

클라이언트에서 인증 상태를 관리하기 위한 hooks:

```typescript
// hooks/useAuth.ts
import { useSupabaseUser } from '@supabase/auth-helpers-nextjs';

export function useAuth() {
  const user = useSupabaseUser();

  return {
    user,
    isLoading: false,
    signOut: () => supabase.auth.signOut()
  };
}
