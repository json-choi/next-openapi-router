# Best Practices

이 가이드는 `next-router`를 프로덕션 환경에서 효과적으로 사용하기 위한 모범 사례를 제시합니다.

## Table of Contents

1. [Project Structure](#project-structure)
2. [Schema Design](#schema-design)
3. [Authentication & Authorization](#authentication--authorization)
4. [Error Handling](#error-handling)
5. [Performance Optimization](#performance-optimization)
6. [Security Considerations](#security-considerations)
7. [Testing Strategies](#testing-strategies)
8. [OpenAPI Documentation](#openapi-documentation)
9. [Monitoring & Observability](#monitoring--observability)
10. [Code Style & Conventions](#code-style--conventions)

---

## Project Structure

### 권장 디렉토리 구조

```
src/
├── app/api/
│   ├── auth/
│   │   ├── login/route.ts
│   │   └── logout/route.ts
│   ├── users/
│   │   ├── route.ts
│   │   └── [id]/route.ts
│   ├── posts/
│   │   ├── route.ts
│   │   └── [id]/route.ts
│   └── docs/
│       └── route.ts
├── lib/
│   ├── auth/
│   │   ├── providers/
│   │   │   ├── nextauth.ts
│   │   │   ├── clerk.ts
│   │   │   └── jwt.ts
│   │   └── index.ts
│   ├── controllers/
│   │   ├── base.ts
│   │   ├── admin.ts
│   │   └── public.ts
│   ├── schemas/
│   │   ├── auth.ts
│   │   ├── user.ts
│   │   └── post.ts
│   ├── types/
│   │   └── index.ts
│   └── utils/
│       ├── validation.ts
│       └── errors.ts
└── middleware.ts
```

### 모듈 분리

#### ✅ 좋은 예시

```typescript
// lib/schemas/user.ts
import { z } from 'zod';

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(['admin', 'user', 'moderator']),
});

export const CreateUserSchema = UserSchema.omit({ id: true });
export const UpdateUserSchema = UserSchema.partial().omit({ id: true });

// lib/controllers/user.ts
import { createController } from 'next-router';
import { authProvider } from '../auth';

export const userController = createController({
  auth: authProvider,
  onAuthError: () => createErrorResponse('Unauthorized', 401),
});

// app/api/users/route.ts
import { userController } from '../../../lib/controllers/user';
import { CreateUserSchema, UserSchema } from '../../../lib/schemas/user';

export const POST = userController.post({
  bodySchema: CreateUserSchema,
  responseSchema: UserSchema,
  auth: 'required',
}, async ({ body, user }) => {
  // 구현
});
```

#### ❌ 피해야 할 예시

```typescript
// app/api/users/route.ts - 모든 것을 한 파일에
import { z } from 'zod';

const UserSchema = z.object({ /* ... */ }); // 재사용 불가
const authProvider = { /* ... */ }; // 중복 정의
const controller = createController({ /* ... */ }); // 중복 정의

export const POST = controller.post(/* ... */);
```

---

## Schema Design

### 스키마 설계 원칙

#### 1. 재사용 가능한 스키마 작성

```typescript
// lib/schemas/common.ts
export const PaginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export const TimestampSchema = z.object({
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// lib/schemas/user.ts
import { PaginationSchema, TimestampSchema } from './common';

export const GetUsersQuerySchema = PaginationSchema.extend({
  role: z.enum(['admin', 'user']).optional(),
  search: z.string().optional(),
});

export const UserResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  role: z.string(),
}).merge(TimestampSchema);
```

#### 2. 명확한 에러 메시지

```typescript
// ✅ 좋은 예시
const CreatePostSchema = z.object({
  title: z.string()
    .min(5, 'Title must be at least 5 characters')
    .max(100, 'Title must not exceed 100 characters'),
  content: z.string()
    .min(10, 'Content must be at least 10 characters'),
  tags: z.array(z.string())
    .max(5, 'Maximum 5 tags allowed')
    .optional(),
});

// ❌ 피해야 할 예시
const CreatePostSchema = z.object({
  title: z.string().min(5).max(100), // 에러 메시지 없음
  content: z.string().min(10),
  tags: z.array(z.string()).max(5).optional(),
});
```

#### 3. 타입 안전한 변환

```typescript
// ✅ 좋은 예시
const QuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  active: z.coerce.boolean().optional(),
  createdAfter: z.string().datetime().optional()
    .transform(val => val ? new Date(val) : undefined),
});

// ❌ 피해야 할 예시
const QuerySchema = z.object({
  page: z.string(), // 숫자 변환 없음
  active: z.string(), // 불린 변환 없음
  createdAfter: z.string(), // 날짜 변환 없음
});
```

### 응답 스키마 설계

```typescript
// 성공 응답 템플릿
export const createSuccessResponse = <T extends z.ZodType>(dataSchema: T) => {
  return z.object({
    success: z.literal(true),
    data: dataSchema,
    timestamp: z.string().datetime(),
  });
};

// 에러 응답 템플릿
export const ErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional(),
  }),
  timestamp: z.string().datetime(),
});

// 사용 예시
export const GetUserResponseSchema = createSuccessResponse(UserSchema);
```

---

## Authentication & Authorization

### 인증 제공자 설계

#### 1. 일관된 인터페이스

```typescript
// lib/auth/base.ts
export abstract class BaseAuthProvider<TUser extends GenericUser>
  implements AuthProvider<TUser> {

  abstract authenticate(request: NextRequest): Promise<TUser | null>;

  async authorize(user: TUser, request: NextRequest): Promise<boolean> {
    // 기본 권한 로직
    return true;
  }

  getRoles(user: TUser): string[] {
    return [];
  }

  // 공통 헬퍼 메서드
  protected extractBearerToken(request: NextRequest): string | null {
    const auth = request.headers.get('authorization');
    return auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  }
}
```

#### 2. 환경별 설정

```typescript
// lib/auth/index.ts
import { nextAuthProvider } from './providers/nextauth';
import { clerkProvider } from './providers/clerk';
import { jwtProvider } from './providers/jwt';

const getAuthProvider = () => {
  const provider = process.env.AUTH_PROVIDER;

  switch (provider) {
    case 'nextauth':
      return nextAuthProvider;
    case 'clerk':
      return clerkProvider;
    case 'jwt':
      return jwtProvider;
    default:
      throw new Error(`Unknown auth provider: ${provider}`);
  }
};

export const authProvider = getAuthProvider();
```

#### 3. 권한 기반 라우팅

```typescript
// lib/controllers/admin.ts
export const adminController = createController({
  auth: authProvider,
  onAuthError: () => NextResponse.json(
    { error: 'Authentication required' },
    { status: 401 }
  ),
  onAuthorizeError: () => NextResponse.json(
    { error: 'Insufficient permissions' },
    { status: 403 }
  ),
});

// app/api/admin/users/route.ts
export const GET = adminController.get({
  auth: 'required',
  metadata: {
    summary: 'List all users (Admin only)',
    tags: ['Admin', 'Users'],
    security: [{ bearerAuth: [] }],
  },
}, async ({ user }) => {
  // 관리자만 접근 가능
});
```

---

## Error Handling

### 통합 에러 처리

#### 1. 표준화된 에러 응답

```typescript
// lib/errors/types.ts
export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTH_ERROR',
  AUTHORIZATION_ERROR = 'AUTHZ_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  RATE_LIMIT = 'RATE_LIMIT',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

export interface ApiError {
  code: ErrorCode;
  message: string;
  details?: any;
  statusCode: number;
}

// lib/errors/factory.ts
export const createApiError = (
  code: ErrorCode,
  message: string,
  statusCode: number,
  details?: any
): NextResponse => {
  return NextResponse.json(
    {
      success: false,
      error: { code, message, details },
      timestamp: new Date().toISOString(),
    },
    { status: statusCode }
  );
};
```

#### 2. 계층별 에러 처리

```typescript
// lib/controllers/base.ts
export const baseController = createController({
  auth: authProvider,
  onAuthError: () => createApiError(
    ErrorCode.AUTHENTICATION_ERROR,
    'Authentication required',
    401
  ),
  onValidationError: (errors) => createApiError(
    ErrorCode.VALIDATION_ERROR,
    'Invalid input data',
    400,
    errors
  ),
  onInternalError: (error) => {
    console.error('Internal error:', error);

    // 프로덕션에서는 상세 에러 정보 숨김
    const message = process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : error.message;

    return createApiError(
      ErrorCode.INTERNAL_ERROR,
      message,
      500
    );
  },
});
```

#### 3. 비즈니스 로직 에러

```typescript
// lib/services/user.ts
export class UserNotFoundError extends Error {
  constructor(id: string) {
    super(`User with id ${id} not found`);
    this.name = 'UserNotFoundError';
  }
}

// app/api/users/[id]/route.ts
export const GET = baseController.get({
  paramsSchema: z.object({ id: z.string().uuid() }),
  responseSchema: UserResponseSchema,
  auth: 'required',
}, async ({ params }) => {
  try {
    const user = await getUserById(params!.id);
    return NextResponse.json(user);
  } catch (error) {
    if (error instanceof UserNotFoundError) {
      return createApiError(
        ErrorCode.NOT_FOUND,
        error.message,
        404
      );
    }
    throw error; // 다른 에러는 글로벌 핸들러가 처리
  }
});
```

---

## Performance Optimization

### 1. 응답 검증 최적화

```typescript
// 개발 환경에서만 응답 검증
export const createOptimizedRoute = <T, U, V, W>(
  config: RouteConfig<T, U, V, W>,
  handler: RouteHandler<T, U, V, W, any>
) => {
  return createRoute({
    ...config,
    validateResponse: process.env.NODE_ENV === 'development',
  }, handler);
};
```

### 2. 스키마 캐싱

```typescript
// lib/schemas/cache.ts
const schemaCache = new Map();

export const getCachedSchema = <T extends z.ZodType>(
  key: string,
  factory: () => T
): T => {
  if (!schemaCache.has(key)) {
    schemaCache.set(key, factory());
  }
  return schemaCache.get(key);
};

// 사용 예시
export const UserSchema = getCachedSchema('user', () =>
  z.object({
    id: z.string().uuid(),
    name: z.string(),
    email: z.string().email(),
  })
);
```

### 3. 페이지네이션

```typescript
// lib/schemas/pagination.ts
export const PaginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const createPaginatedResponse = <T extends z.ZodType>(itemSchema: T) => {
  return z.object({
    items: z.array(itemSchema),
    pagination: z.object({
      page: z.number(),
      limit: z.number(),
      totalCount: z.number(),
      totalPages: z.number(),
      hasNext: z.boolean(),
      hasPrev: z.boolean(),
    }),
  });
};
```

---

## Security Considerations

### 1. 입력 검증 및 새니타이제이션

```typescript
// lib/schemas/security.ts
import { z } from 'zod';

// HTML 태그 제거
const sanitizeHtml = (str: string) => str.replace(/<[^>]*>/g, '');

// XSS 방지를 위한 문자열 스키마
export const SafeStringSchema = z.string()
  .max(1000) // 길이 제한
  .transform(sanitizeHtml)
  .refine(
    val => !val.includes('<script>'),
    'Script tags are not allowed'
  );

// SQL Injection 방지
export const SafeSearchSchema = z.string()
  .max(100)
  .regex(
    /^[a-zA-Z0-9\s\-_]+$/,
    'Only alphanumeric characters, spaces, hyphens and underscores are allowed'
  );
```

### 2. Rate Limiting

```typescript
// lib/middleware/rateLimit.ts
import { NextRequest } from 'next/server';

const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export const createRateLimiter = (maxRequests: number, windowMs: number) => {
  return (request: NextRequest): boolean => {
    const clientIP = request.ip || 'unknown';
    const now = Date.now();
    const key = `${clientIP}:${request.nextUrl.pathname}`;

    const current = rateLimitStore.get(key);

    if (!current || now > current.resetTime) {
      rateLimitStore.set(key, {
        count: 1,
        resetTime: now + windowMs,
      });
      return true;
    }

    if (current.count >= maxRequests) {
      return false;
    }

    current.count++;
    return true;
  };
};

// 사용 예시
const apiRateLimit = createRateLimiter(100, 15 * 60 * 1000); // 15분에 100회

export const rateLimitedController = createController({
  auth: authProvider,
  onAuthError: () => createApiError(ErrorCode.AUTHENTICATION_ERROR, 'Unauthorized', 401),
  onInternalError: (error) => {
    if (error.message === 'Rate limit exceeded') {
      return createApiError(ErrorCode.RATE_LIMIT, 'Too many requests', 429);
    }
    return createApiError(ErrorCode.INTERNAL_ERROR, 'Internal error', 500);
  },
});
```

### 3. 민감한 데이터 보호

```typescript
// lib/schemas/user.ts
export const PublicUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  avatar: z.string().url().optional(),
  createdAt: z.string(),
});

export const PrivateUserSchema = PublicUserSchema.extend({
  email: z.string().email(),
  role: z.string(),
  lastLoginAt: z.string().optional(),
});

// 사용자 역할에 따라 다른 스키마 사용
export const GET = controller.get({
  paramsSchema: z.object({ id: z.string().uuid() }),
  auth: 'required',
}, async ({ params, user }) => {
  const userData = await getUserById(params!.id);

  // 본인 또는 관리자만 전체 정보 조회 가능
  const canViewPrivate = user!.id === params!.id || user!.role === 'admin';
  const schema = canViewPrivate ? PrivateUserSchema : PublicUserSchema;

  const sanitizedData = schema.parse(userData);
  return NextResponse.json(sanitizedData);
});
```

---

## Testing Strategies

### 1. Unit Tests

```typescript
// tests/schemas/user.test.ts
import { describe, it, expect } from 'vitest';
import { CreateUserSchema } from '../../lib/schemas/user';

describe('User Schema', () => {
  describe('CreateUserSchema', () => {
    it('should validate correct user data', () => {
      const validUser = {
        name: 'John Doe',
        email: 'john@example.com',
        role: 'user',
      };

      const result = CreateUserSchema.parse(validUser);
      expect(result).toEqual(validUser);
    });

    it('should reject invalid email', () => {
      const invalidUser = {
        name: 'John Doe',
        email: 'invalid-email',
        role: 'user',
      };

      expect(() => CreateUserSchema.parse(invalidUser)).toThrow();
    });
  });
});
```

### 2. Integration Tests

```typescript
// tests/api/users.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { testClient } from '../utils/testClient';

describe('/api/users', () => {
  let authToken: string;

  beforeAll(async () => {
    authToken = await testClient.login('admin@example.com', 'password');
  });

  describe('GET /api/users', () => {
    it('should return paginated users', async () => {
      const response = await testClient.get('/api/users?page=1&limit=10', {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('items');
      expect(response.data).toHaveProperty('pagination');
    });

    it('should require authentication', async () => {
      const response = await testClient.get('/api/users');
      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/users', () => {
    it('should create a new user', async () => {
      const newUser = {
        name: 'Test User',
        email: 'test@example.com',
        role: 'user',
      };

      const response = await testClient.post('/api/users', newUser, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.status).toBe(201);
      expect(response.data).toMatchObject(newUser);
      expect(response.data).toHaveProperty('id');
    });
  });
});
```

### 3. 테스트 유틸리티

```typescript
// tests/utils/testClient.ts
export class TestClient {
  private baseUrl = 'http://localhost:3000';

  async login(email: string, password: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    return data.token;
  }

  async get(path: string, options?: RequestInit) {
    return this.request('GET', path, null, options);
  }

  async post(path: string, body: any, options?: RequestInit) {
    return this.request('POST', path, body, options);
  }

  private async request(
    method: string,
    path: string,
    body: any,
    options: RequestInit = {}
  ) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      ...options,
    });

    const data = await response.json();
    return { status: response.status, data };
  }
}

export const testClient = new TestClient();
```

---

## OpenAPI Documentation

### 1. 메타데이터 일관성

```typescript
// lib/metadata/common.ts
export const commonTags = {
  AUTH: 'Authentication',
  USERS: 'Users',
  POSTS: 'Posts',
  ADMIN: 'Admin',
} as const;

export const securitySchemes = {
  bearerAuth: {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
  },
} as const;

// app/api/users/route.ts
export const GET = controller.get({
  querySchema: GetUsersQuerySchema,
  responseSchema: UsersResponseSchema,
  auth: 'required',
  metadata: {
    summary: 'List users with pagination',
    description: 'Retrieve a paginated list of users with optional filtering',
    tags: [commonTags.USERS],
    security: [{ bearerAuth: [] }],
  },
}, handler);
```

### 2. 예시 데이터 추가

```typescript
// lib/schemas/user.ts
export const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(['admin', 'user']),
}).openapi({
  example: {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'John Doe',
    email: 'john@example.com',
    role: 'user',
  },
});
```

---

## Monitoring & Observability

### 1. 로깅

```typescript
// lib/logging/logger.ts
export interface LogContext {
  requestId?: string;
  userId?: string;
  method: string;
  path: string;
  statusCode?: number;
  duration?: number;
  error?: Error;
}

export const logger = {
  info: (message: string, context?: LogContext) => {
    console.log(JSON.stringify({
      level: 'info',
      message,
      timestamp: new Date().toISOString(),
      ...context,
    }));
  },

  error: (message: string, error: Error, context?: LogContext) => {
    console.error(JSON.stringify({
      level: 'error',
      message,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      timestamp: new Date().toISOString(),
      ...context,
    }));
  },
};

// lib/controllers/monitored.ts
export const monitoredController = createController({
  auth: authProvider,
  onInternalError: (error, context) => {
    logger.error('API Error', error, {
      requestId: context?.request.headers.get('x-request-id') || undefined,
      method: context?.request.method || 'unknown',
      path: context?.request.nextUrl.pathname || 'unknown',
    });

    return createApiError(ErrorCode.INTERNAL_ERROR, 'Internal error', 500);
  },
});
```

### 2. 메트릭스

```typescript
// lib/metrics/collector.ts
export class MetricsCollector {
  private static instance: MetricsCollector;
  private metrics = new Map<string, number>();

  static getInstance(): MetricsCollector {
    if (!this.instance) {
      this.instance = new MetricsCollector();
    }
    return this.instance;
  }

  incrementCounter(name: string, tags: Record<string, string> = {}) {
    const key = `${name}:${JSON.stringify(tags)}`;
    this.metrics.set(key, (this.metrics.get(key) || 0) + 1);
  }

  recordDuration(name: string, duration: number, tags: Record<string, string> = {}) {
    const key = `${name}_duration:${JSON.stringify(tags)}`;
    this.metrics.set(key, duration);
  }

  getMetrics() {
    return Object.fromEntries(this.metrics.entries());
  }
}
```

---

## Code Style & Conventions

### 1. 명명 규칙

```typescript
// ✅ 좋은 예시
export const GetUsersQuerySchema = z.object({ /* ... */ });
export const CreateUserBodySchema = z.object({ /* ... */ });
export const UserResponseSchema = z.object({ /* ... */ });

export const userController = createController({ /* ... */ });
export const adminController = createController({ /* ... */ });

// ❌ 피해야 할 예시
export const getUsersQuery = z.object({ /* ... */ }); // 일관성 없음
export const createUserBody = z.object({ /* ... */ });
export const response = z.object({ /* ... */ }); // 너무 모호함
```

### 2. 파일 구성

```typescript
// app/api/users/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';

// 1. 외부 의존성 import
import { userController } from '../../../lib/controllers/user';
import { CreateUserSchema, UserResponseSchema } from '../../../lib/schemas/user';
import { createApiError, ErrorCode } from '../../../lib/errors';

// 2. 로컬 타입 정의 (필요한 경우)
// 3. 상수 정의 (필요한 경우)
// 4. 헬퍼 함수 (필요한 경우)

// 5. 라우트 핸들러들
export const GET = userController.get({
  // 설정 객체
}, async (context) => {
  // 핸들러 구현
});

export const POST = userController.post({
  // 설정 객체
}, async (context) => {
  // 핸들러 구현
});
```

### 3. 주석 및 문서화

```typescript
/**
 * Create a new user account
 *
 * @summary Create user
 * @description Creates a new user account with the provided information.
 * Only administrators can create user accounts.
 *
 * @param body User information
 * @returns Created user data
 */
export const POST = adminController.post({
  bodySchema: CreateUserSchema,
  responseSchema: UserResponseSchema,
  auth: 'required',
  metadata: {
    summary: 'Create a new user',
    description: 'Creates a new user account (Admin only)',
    tags: ['Admin', 'Users'],
  },
}, async ({ body, user }) => {
  // 구현...
});
```

---

## Deployment Checklist

### 프로덕션 배포 전 체크리스트

- [ ] **환경변수 설정**: 모든 필수 환경변수 설정 완료
- [ ] **스키마 검증**: 모든 API 엔드포인트에 적절한 스키마 정의
- [ ] **인증 설정**: 프로덕션 인증 제공자 설정
- [ ] **에러 처리**: 모든 에러 케이스에 대한 적절한 처리
- [ ] **로깅 설정**: 적절한 로그 레벨 및 구조화된 로깅
- [ ] **성능 테스트**: 예상 트래픽에 대한 성능 테스트
- [ ] **보안 검토**: 보안 취약점 검토 및 해결
- [ ] **API 문서**: 최신 OpenAPI 문서 생성 및 배포
- [ ] **모니터링**: 메트릭스 및 알럿 설정
- [ ] **백업 계획**: 데이터 백업 및 복구 계획

---

이러한 모범 사례들을 따르면 `next-router`를 사용하여 확장 가능하고 유지보수가 용이한 API를 구축할 수 있습니다. 프로젝트의 특성에 맞게 적절히 조정하여 사용하세요.
