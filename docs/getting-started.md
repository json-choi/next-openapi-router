# Getting Started

이 가이드는 `next-router`를 Next.js 15 App Router 프로젝트에 설치하고 설정하는 방법을 단계별로 안내합니다.

## Prerequisites

시작하기 전에 다음이 설치되어 있는지 확인하세요:

- Node.js 18.x 이상
- Next.js 15.x
- TypeScript (권장)

## Installation

### 1. 패키지 설치

```bash
npm install next-router zod
# 또는
yarn add next-router zod
# 또는
pnpm add next-router zod
```

### 2. TypeScript 설정 (선택사항)

`tsconfig.json`에서 strict mode를 활성화하는 것을 권장합니다:

```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "module": "esnext",
    "moduleResolution": "bundler"
  }
}
```

## Quick Start

### Step 1: 첫 번째 API 라우트 생성

간단한 API 라우트를 만들어 보겠습니다.

**app/api/hello/route.ts**

```typescript
import { NextResponse } from 'next/server';
import { createRoute } from 'next-router';
import { z } from 'zod';

// 응답 스키마 정의
const HelloResponseSchema = z.object({
  message: z.string(),
  timestamp: z.string(),
});

// GET 라우트 생성
export const GET = createRoute({
  responseSchema: HelloResponseSchema,
  auth: false, // 인증 불필요
}, async () => {
  return NextResponse.json({
    message: 'Hello from next-router!',
    timestamp: new Date().toISOString(),
  });
});
```

이제 `/api/hello`에 GET 요청을 보내면 응답을 받을 수 있습니다.

### Step 2: 쿼리 파라미터 검증

쿼리 파라미터를 받는 라우트를 만들어 보겠습니다.

**app/api/users/route.ts**

```typescript
import { NextResponse } from 'next/server';
import { createRoute } from 'next-router';
import { z } from 'zod';

// 쿼리 파라미터 스키마
const GetUsersQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
  search: z.string().optional(),
});

// 응답 스키마
const UsersResponseSchema = z.object({
  users: z.array(z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
  })),
  totalCount: z.number(),
  page: z.number(),
  limit: z.number(),
});

export const GET = createRoute({
  querySchema: GetUsersQuerySchema,
  responseSchema: UsersResponseSchema,
  auth: false,
}, async ({ query }) => {
  // 쿼리는 자동으로 검증되고 타입이 추론됩니다
  const { page, limit, search } = query!;

  // Mock 데이터 (실제로는 데이터베이스에서 조회)
  const mockUsers = [
    { id: '1', name: 'John Doe', email: 'john@example.com' },
    { id: '2', name: 'Jane Smith', email: 'jane@example.com' },
  ];

  return NextResponse.json({
    users: mockUsers,
    totalCount: mockUsers.length,
    page,
    limit,
  });
});
```

### Step 3: POST 요청과 바디 검증

사용자를 생성하는 POST 라우트를 만들어 보겠습니다.

**app/api/users/route.ts** (위 파일에 추가)

```typescript
// 요청 바디 스키마
const CreateUserBodySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email format'),
  role: z.enum(['admin', 'user']).default('user'),
});

// 생성된 사용자 응답 스키마
const UserResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.string(),
  createdAt: z.string(),
});

export const POST = createRoute({
  bodySchema: CreateUserBodySchema,
  responseSchema: UserResponseSchema,
  auth: false, // 나중에 인증을 추가할 예정
}, async ({ body }) => {
  // body는 자동으로 검증되고 타입이 추론됩니다
  const userData = body!;

  // Mock 사용자 생성 (실제로는 데이터베이스에 저장)
  const newUser = {
    id: crypto.randomUUID(),
    ...userData,
    createdAt: new Date().toISOString(),
  };

  return NextResponse.json(newUser, { status: 201 });
});
```

### Step 4: 경로 파라미터 처리

특정 사용자를 조회하는 라우트를 만들어 보겠습니다.

**app/api/users/[id]/route.ts**

```typescript
import { NextResponse } from 'next/server';
import { createRoute } from 'next-router';
import { z } from 'zod';

// 경로 파라미터 스키마
const UserParamsSchema = z.object({
  id: z.string().uuid('Invalid user ID format'),
});

const UserResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.string(),
});

export const GET = createRoute({
  paramsSchema: UserParamsSchema,
  responseSchema: UserResponseSchema,
  auth: false,
}, async ({ params }) => {
  const { id } = params!;

  // Mock 사용자 조회
  const mockUser = {
    id,
    name: 'John Doe',
    email: 'john@example.com',
    role: 'user',
  };

  return NextResponse.json(mockUser);
});
```

## 인증 설정

### Step 5: 인증 제공자 생성

간단한 토큰 기반 인증을 구현해보겠습니다.

**lib/auth.ts**

```typescript
import { NextRequest } from 'next/server';
import type { AuthProvider, GenericUser } from 'next-router';

// 사용자 타입 정의
interface User extends GenericUser {
  id: string;
  email: string;
  role: 'admin' | 'user';
}

// 인증 제공자 구현
export const authProvider: AuthProvider<User> = {
  async authenticate(request: NextRequest): Promise<User | null> {
    const authHeader = request.headers.get('authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.slice(7);

    // 간단한 토큰 검증 (실제로는 JWT 검증 등을 사용)
    if (token === 'valid-admin-token') {
      return {
        id: '1',
        email: 'admin@example.com',
        role: 'admin',
      };
    }

    if (token === 'valid-user-token') {
      return {
        id: '2',
        email: 'user@example.com',
        role: 'user',
      };
    }

    return null;
  },

  async authorize(user: User, request: NextRequest): Promise<boolean> {
    const url = new URL(request.url);

    // 관리자 전용 라우트
    if (url.pathname.startsWith('/api/admin')) {
      return user.role === 'admin';
    }

    return true;
  },

  getRoles(user: User): string[] {
    return [user.role];
  },
};
```

### Step 6: 컨트롤러 설정

인증이 적용된 컨트롤러를 만들어 보겠습니다.

**lib/controller.ts**

```typescript
import { createController } from 'next-router';
import { NextResponse } from 'next/server';
import { authProvider } from './auth';

export const controller = createController({
  auth: authProvider,
  onAuthError: () => {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  },
  onValidationError: (errors) => {
    return NextResponse.json(
      {
        error: 'Validation failed',
        details: errors
      },
      { status: 400 }
    );
  },
});
```

### Step 7: 인증된 라우트 생성

이제 인증이 필요한 라우트를 만들어 보겠습니다.

**app/api/profile/route.ts**

```typescript
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { controller } from '../../lib/controller';

const ProfileResponseSchema = z.object({
  id: z.string(),
  email: z.string(),
  role: z.string(),
});

export const GET = controller.get({
  responseSchema: ProfileResponseSchema,
  auth: 'required', // 인증 필수
}, async ({ user }) => {
  // user는 자동으로 인증되고 타입이 추론됩니다
  return NextResponse.json({
    id: user!.id,
    email: user!.email,
    role: user!.role,
  });
});
```

## 테스트

### Step 8: API 테스트

이제 생성한 API를 테스트해보겠습니다.

```bash
# 기본 라우트 테스트
curl http://localhost:3000/api/hello

# 쿼리 파라미터 테스트
curl "http://localhost:3000/api/users?page=1&limit=5"

# POST 요청 테스트
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"name":"John Doe","email":"john@example.com"}'

# 인증된 라우트 테스트
curl http://localhost:3000/api/profile \
  -H "Authorization: Bearer valid-user-token"
```

## OpenAPI 문서 생성

### Step 9: OpenAPI 문서 엔드포인트 생성

API 문서를 자동 생성하는 엔드포인트를 만들어 보겠습니다.

**app/api/docs/route.ts**

```typescript
import { NextResponse } from 'next/server';
import { generateOpenAPI } from 'next-router';

export async function GET() {
  const spec = generateOpenAPI({
    info: {
      title: 'My API',
      version: '1.0.0',
      description: 'API built with next-router',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
    ],
  });

  return NextResponse.json(spec);
}
```

이제 `/api/docs`를 방문하면 자동 생성된 OpenAPI 스펙을 볼 수 있습니다.

## 에러 처리

### Step 10: 커스텀 에러 처리

더 세밀한 에러 처리를 위해 컨트롤러를 개선해보겠습니다.

**lib/controller.ts** (업데이트)

```typescript
import { createController } from 'next-router';
import { NextResponse } from 'next/server';
import { authProvider } from './auth';

export const controller = createController({
  auth: authProvider,
  onAuthError: () => {
    return NextResponse.json(
      {
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
        message: 'Please provide a valid authorization token'
      },
      { status: 401 }
    );
  },
  onValidationError: (errors) => {
    return NextResponse.json(
      {
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors.map(err => ({
          field: err.field,
          message: err.message,
          code: err.code
        }))
      },
      { status: 400 }
    );
  },
  onInternalError: (error) => {
    console.error('Internal server error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred'
      },
      { status: 500 }
    );
  },
});
```

## Next Steps

축하합니다! `next-router`의 기본 사용법을 익혔습니다. 다음 단계로 넘어가서 더 고급 기능들을 알아보세요:

1. **[Auth Provider 예제](../examples/)** - 실제 인증 제공자 통합 방법
   - NextAuth.js 통합
   - Clerk 통합
   - Supabase Auth 통합
   - Custom JWT 구현

2. **[Best Practices](best-practices.md)** - 프로덕션 환경을 위한 모범 사례

3. **[API Reference](api-reference.md)** - 전체 API 문서

4. **[Migration Guide](migration.md)** - 기존 프로젝트 마이그레이션

## Troubleshooting

### 자주 발생하는 문제들

**1. TypeScript 타입 에러**
```
Property 'query' does not exist on type 'undefined'
```
해결: 스키마를 정의하고 non-null assertion (`!`) 또는 옵셔널 체이닝 (`?.`)을 사용하세요.

**2. 인증 실패**
```json
{"error": "Authentication required"}
```
해결: Authorization 헤더가 올바른 형식인지 확인하세요: `Bearer <token>`

**3. 검증 실패**
```json
{"error": "Validation failed", "details": [...]}
```
해결: 요청 데이터가 정의한 스키마와 일치하는지 확인하세요.

## Community & Support

- [GitHub Issues](https://github.com/your-org/next-router/issues) - 버그 리포트 및 기능 요청
- [Discussions](https://github.com/your-org/next-router/discussions) - 질문 및 토론
- [Examples](https://github.com/your-org/next-router/tree/main/examples) - 실제 사용 예제들

Happy coding! 🚀
