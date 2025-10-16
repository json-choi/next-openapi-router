# Migration Guide

이 가이드는 기존 Next.js API Routes를 `next-router`로 마이그레이션하는 방법을 안내합니다.

## Why Migrate?

`next-router`로 마이그레이션하면 다음과 같은 이점을 얻을 수 있습니다:

- **타입 안전성**: 자동 타입 추론으로 런타임 에러 감소
- **입력 검증**: Zod 스키마를 통한 자동 데이터 검증
- **Spring-style**: 익숙한 Spring Framework 스타일의 API 개발
- **OpenAPI 자동 생성**: API 문서 자동화
- **표준화된 에러 처리**: 일관된 에러 응답 형식
- **인증 추상화**: 다양한 인증 시스템 지원

## Before You Start

마이그레이션을 시작하기 전에:

1. **백업 생성**: 기존 코드를 백업하세요
2. **의존성 확인**: Next.js 15+ 및 TypeScript 사용을 권장합니다
3. **점진적 마이그레이션**: 한 번에 모든 라우트를 변경하지 말고 점진적으로 진행하세요

## Migration Steps

### Step 1: 패키지 설치

```bash
npm install next-router zod
```

### Step 2: 기본 구조 비교

#### Before (기존 Next.js API Route)

```typescript
// pages/api/users.ts 또는 app/api/users/route.ts
import { NextApiRequest, NextApiResponse } from 'next';
// 또는 Next.js 13+ App Router
import { NextRequest } from 'next/server';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    // 쿼리 파라미터 수동 검증
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    // 수동 에러 처리
    if (limit > 100) {
      return res.status(400).json({ error: 'Limit too high' });
    }

    const users = getUsersFromDB(page, limit);
    res.status(200).json({ users, page, limit });
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
```

#### After (next-router)

```typescript
// app/api/users/route.ts
import { NextResponse } from 'next/server';
import { createRoute } from 'next-router';
import { z } from 'zod';

const QuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
});

const ResponseSchema = z.object({
  users: z.array(z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
  })),
  page: z.number(),
  limit: z.number(),
});

export const GET = createRoute({
  querySchema: QuerySchema,
  responseSchema: ResponseSchema,
  auth: false,
}, async ({ query }) => {
  const { page, limit } = query!;
  const users = await getUsersFromDB(page, limit);

  return NextResponse.json({ users, page, limit });
});
```

### Step 3: 패턴별 마이그레이션

#### 1. 쿼리 파라미터 처리

**Before:**
```typescript
const { page, limit, search } = req.query;
const pageNum = parseInt(page as string) || 1;
const limitNum = parseInt(limit as string) || 10;

// 수동 검증
if (limitNum > 100) {
  return res.status(400).json({ error: 'Limit too high' });
}
```

**After:**
```typescript
const QuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
  search: z.string().optional(),
});

// 스키마가 자동으로 검증하고 타입을 추론합니다
```

#### 2. 요청 바디 처리

**Before:**
```typescript
if (req.method === 'POST') {
  const { name, email } = req.body;

  // 수동 검증
  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email required' });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Invalid email' });
  }

  const user = await createUser({ name, email });
  res.status(201).json(user);
}
```

**After:**
```typescript
const BodySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email format'),
});

export const POST = createRoute({
  bodySchema: BodySchema,
  responseSchema: UserResponseSchema,
  auth: false,
}, async ({ body }) => {
  const user = await createUser(body!);
  return NextResponse.json(user, { status: 201 });
});
```

#### 3. 경로 파라미터 처리

**Before:**
```typescript
// pages/api/users/[id].ts
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  // ID 검증
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid ID' });
  }

  if (!isValidUUID(id)) {
    return res.status(400).json({ error: 'Invalid UUID format' });
  }

  const user = getUserById(id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json(user);
}
```

**After:**
```typescript
// app/api/users/[id]/route.ts
const ParamsSchema = z.object({
  id: z.string().uuid('Invalid UUID format'),
});

export const GET = createRoute({
  paramsSchema: ParamsSchema,
  responseSchema: UserResponseSchema,
  auth: false,
}, async ({ params }) => {
  const { id } = params!;
  const user = await getUserById(id);

  if (!user) {
    return NextResponse.json(
      { error: 'User not found' },
      { status: 404 }
    );
  }

  return NextResponse.json(user);
});
```

#### 4. 인증 처리

**Before:**
```typescript
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 수동 인증 체크
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const user = await verifyToken(token);
  if (!user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  // 권한 체크
  if (req.url?.startsWith('/api/admin') && user.role !== 'admin') {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  // 라우트 로직...
}
```

**After:**
```typescript
// lib/auth.ts
const authProvider: AuthProvider<User> = {
  async authenticate(request) {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return null;
    return await verifyToken(token);
  },
  async authorize(user, request) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/admin')) {
      return user.role === 'admin';
    }
    return true;
  },
  getRoles(user) {
    return [user.role];
  },
};

// lib/controller.ts
const controller = createController({
  auth: authProvider,
  onAuthError: () => NextResponse.json(
    { error: 'Unauthorized' },
    { status: 401 }
  ),
});

// app/api/protected/route.ts
export const GET = controller.get({
  auth: 'required', // 인증 자동 처리
  responseSchema: ResponseSchema,
}, async ({ user }) => {
  // user는 자동으로 인증되고 타입이 추론됩니다
  return NextResponse.json({ message: `Hello ${user!.name}` });
});
```

#### 5. 에러 처리

**Before:**
```typescript
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // 라우트 로직...

    if (someError) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid input data'
      });
    }

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Something went wrong'
    });
  }
}
```

**After:**
```typescript
// lib/controller.ts
const controller = createController({
  onValidationError: (errors) => {
    return NextResponse.json(
      {
        error: 'Validation failed',
        details: errors
      },
      { status: 400 }
    );
  },
  onInternalError: (error) => {
    console.error('Internal error:', error);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: 'Something went wrong'
      },
      { status: 500 }
    );
  },
});

// 에러는 자동으로 처리됩니다
```

### Step 4: 점진적 마이그레이션 전략

#### 방법 1: 새 엔드포인트부터 시작

새로운 API 엔드포인트를 `next-router`로 개발하고, 기존 엔드포인트는 유지합니다.

#### 방법 2: 버전 기반 마이그레이션

```
/api/v1/users  (기존)
/api/v2/users  (next-router)
```

#### 방법 3: 기능별 마이그레이션

한 번에 하나의 기능 영역을 마이그레이션합니다:

1. 인증이 필요 없는 간단한 엔드포인트부터
2. 인증이 필요한 엔드포인트
3. 복잡한 비즈니스 로직이 있는 엔드포인트

### Step 5: 테스트 및 검증

#### 1. 기능 테스트

```typescript
// 기존 API와 동일한 동작 확인
describe('User API Migration', () => {
  it('should return users with pagination', async () => {
    const response = await fetch('/api/users?page=1&limit=10');
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('users');
    expect(data).toHaveProperty('page', 1);
    expect(data).toHaveProperty('limit', 10);
  });

  it('should validate query parameters', async () => {
    const response = await fetch('/api/users?limit=101');
    expect(response.status).toBe(400);
  });
});
```

#### 2. 성능 테스트

마이그레이션 전후의 성능을 비교하여 성능 저하가 없는지 확인합니다.

#### 3. 타입 체크

```bash
npx tsc --noEmit
```

## Common Pitfalls

### 1. 스키마 정의 누락

**문제:**
```typescript
export const GET = createRoute({
  // querySchema 누락
}, async ({ query }) => {
  // query가 undefined일 수 있음
  const page = query.page; // 에러 발생 가능
});
```

**해결:**
```typescript
const QuerySchema = z.object({
  page: z.coerce.number().default(1),
});

export const GET = createRoute({
  querySchema: QuerySchema,
}, async ({ query }) => {
  const page = query!.page; // 안전함
});
```

### 2. 인증 설정 불일치

**문제:**
```typescript
// 컨트롤러에 auth 설정 없음
const controller = createController({});

export const GET = controller.get({
  auth: 'required', // 동작하지 않음
}, handler);
```

**해결:**
```typescript
const controller = createController({
  auth: authProvider, // 필수
});
```

### 3. 응답 타입 불일치

**문제:**
```typescript
const ResponseSchema = z.object({
  name: z.string(),
});

export const GET = createRoute({
  responseSchema: ResponseSchema,
}, async () => {
  return NextResponse.json({
    name: 'John',
    age: 30, // 스키마에 없는 필드
  });
});
```

**해결:** 응답 데이터가 스키마와 일치하는지 확인하세요.

## Migration Checklist

- [ ] **의존성 설치**: `next-router`, `zod` 설치
- [ ] **타입 설정**: TypeScript strict mode 활성화
- [ ] **스키마 정의**: 모든 입력/출력에 대한 Zod 스키마 생성
- [ ] **인증 설정**: AuthProvider 구현 및 컨트롤러 설정
- [ ] **에러 처리**: 커스텀 에러 핸들러 설정
- [ ] **라우트 변환**: 기존 API 라우트를 next-router 형식으로 변환
- [ ] **테스트 작성**: 기능 및 통합 테스트
- [ ] **OpenAPI 설정**: API 문서 자동 생성 설정
- [ ] **성능 테스트**: 마이그레이션 전후 성능 비교
- [ ] **문서 업데이트**: API 문서 및 개발 가이드 업데이트

## Post-Migration

마이그레이션 완료 후:

1. **모니터링**: 에러 로그 및 성능 메트릭 확인
2. **팀 교육**: 팀원들에게 새로운 패턴 교육
3. **문서 정리**: 기존 문서 정리 및 새 문서 작성
4. **지속적 개선**: 피드백을 바탕으로 개선사항 적용

## Getting Help

마이그레이션 중 문제가 발생하면:

- [GitHub Issues](https://github.com/your-org/next-router/issues)
- [API Reference](api-reference.md)
- [Best Practices](best-practices.md)
- [Examples](../examples/)

## Conclusion

`next-router`로의 마이그레이션은 초기 투자 시간이 필요하지만, 장기적으로 다음과 같은 이점을 제공합니다:

- **개발 생산성 향상**: 자동 검증 및 타입 추론
- **버그 감소**: 컴파일 타임 타입 체크
- **유지보수성**: 표준화된 패턴과 구조
- **API 문서화**: 자동 OpenAPI 생성

점진적으로 마이그레이션하면서 팀이 새로운 패턴에 익숙해지도록 하는 것을 권장합니다.
