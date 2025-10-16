# API Reference

이 문서는 `next-router` 라이브러리의 완전한 API 참조입니다.

## Table of Contents

- [Core Functions](#core-functions)
  - [createController](#createcontroller)
  - [createRoute](#createroute)
- [Types](#types)
  - [AuthProvider](#authprovider)
  - [ControllerConfig](#controllerconfig)
  - [RouteConfig](#routeconfig)
  - [RouteContext](#routecontext)
  - [RouteHandler](#routehandler)
- [OpenAPI Integration](#openapi-integration)
  - [generateOpenAPI](#generateopenapi)
  - [RouteRegistry](#routeregistry)
- [Utilities](#utilities)
  - [Validation](#validation)
  - [Error Handling](#error-handling)

---

## Core Functions

### createController

컨트롤러 팩토리 함수로, 인증 및 에러 처리가 설정된 라우트 헨들러들을 생성합니다.

```typescript
function createController<TUser = GenericUser>(
  config?: ControllerConfig<TUser>
): Controller<TUser>
```

#### Parameters

- `config` (optional): 컨트롤러 설정 객체

#### Returns

HTTP 메소드별 라우트 생성 함수들을 포함한 컨트롤러 객체

#### Example

```typescript
import { createController } from 'next-router';

const controller = createController({
  auth: myAuthProvider,
  onAuthError: () => NextResponse.json(
    { error: 'Unauthorized' },
    { status: 401 }
  )
});

// 라우트 생성
export const GET = controller.get({
  auth: 'required',
  querySchema: QuerySchema
}, async ({ query, user }) => {
  return NextResponse.json({ data: 'success' });
});
```

### createRoute

개별 라우트 핸들러를 생성하는 함수입니다.

```typescript
function createRoute<TQuery, TBody, TParams, TResponse, TUser = GenericUser>(
  config: RouteConfig<TQuery, TBody, TParams, TResponse>,
  handler: RouteHandler<TQuery, TBody, TParams, TResponse, TUser>
): (request: NextRequest) => Promise<NextResponse>
```

#### Parameters

- `config`: 라우트 설정 객체
- `handler`: 라우트 핸들러 함수

#### Returns

Next.js App Router와 호환되는 라우트 핸들러

#### Example

```typescript
import { createRoute } from 'next-router';
import { z } from 'zod';

const GetUserSchema = z.object({
  id: z.string().uuid()
});

export const GET = createRoute({
  paramsSchema: GetUserSchema,
  responseSchema: UserResponseSchema,
  auth: 'required'
}, async ({ params, user }) => {
  const userData = await getUserById(params.id);
  return NextResponse.json(userData);
});
```

---

## Types

### AuthProvider

인증 제공자 인터페이스입니다.

```typescript
interface AuthProvider<TUser extends GenericUser> {
  authenticate(request: NextRequest): Promise<TUser | null>;
  authorize(user: TUser, request: NextRequest): Promise<boolean>;
  getRoles(user: TUser): string[];
}
```

#### Methods

- `authenticate`: 요청에서 사용자 정보를 추출하고 인증합니다.
- `authorize`: 사용자가 특정 요청에 대한 권한이 있는지 확인합니다.
- `getRoles`: 사용자의 역할 목록을 반환합니다.

#### Example

```typescript
const authProvider: AuthProvider<User> = {
  async authenticate(request) {
    const token = request.headers.get('authorization');
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
  }
};
```

### ControllerConfig

컨트롤러 설정 인터페이스입니다.

```typescript
interface ControllerConfig<TUser = GenericUser> {
  auth?: AuthProvider<TUser>;
  onAuthError?: () => NextResponse;
  onValidationError?: (errors: ValidationError[]) => NextResponse;
  onInternalError?: (error: Error) => NextResponse;
  openapi?: OpenAPIConfig;
}
```

#### Properties

- `auth`: 인증 제공자
- `onAuthError`: 인증 실패 시 호출되는 함수
- `onValidationError`: 검증 실패 시 호출되는 함수
- `onInternalError`: 내부 오류 시 호출되는 함수
- `openapi`: OpenAPI 설정 (선택사항)

### RouteConfig

라우트 설정 인터페이스입니다.

```typescript
interface RouteConfig<TQuery = any, TBody = any, TParams = any, TResponse = any> {
  auth?: "required" | "optional" | false;
  querySchema?: ZodSchema<TQuery>;
  bodySchema?: ZodSchema<TBody>;
  paramsSchema?: ZodSchema<TParams>;
  responseSchema?: ZodSchema<TResponse>;
  responseSchemas?: Record<number, ZodSchema<any>>;
  validateResponse?: boolean;
  metadata?: RouteMetadata;
}
```

#### Properties

- `auth`: 인증 요구사항 설정
- `querySchema`: 쿼리 파라미터 검증 스키마
- `bodySchema`: 요청 바디 검증 스키마
- `paramsSchema`: 경로 파라미터 검증 스키마
- `responseSchema`: 응답 검증 스키마
- `responseSchemas`: HTTP 상태코드별 응답 스키마
- `validateResponse`: 개발 모드에서 응답 검증 여부
- `metadata`: OpenAPI 메타데이터

### RouteContext

라우트 핸들러에 전달되는 컨텍스트 객체입니다.

```typescript
interface RouteContext<TQuery, TBody, TParams, TUser> {
  query?: TQuery;
  body?: TBody;
  params?: TParams;
  user?: TUser;
  request: NextRequest;
}
```

#### Properties

- `query`: 검증된 쿼리 파라미터
- `body`: 검증된 요청 바디
- `params`: 검증된 경로 파라미터
- `user`: 인증된 사용자 정보
- `request`: 원본 Next.js 요청 객체

### RouteHandler

라우트 핸들러 함수 타입입니다.

```typescript
type RouteHandler<TQuery, TBody, TParams, TResponse, TUser> = (
  context: RouteContext<TQuery, TBody, TParams, TUser>
) => Promise<NextResponse>
```

---

## OpenAPI Integration

### generateOpenAPI

등록된 라우트들로부터 OpenAPI 3.0 명세를 생성합니다.

```typescript
function generateOpenAPI(config?: OpenAPIGeneratorConfig): OpenAPISpec
```

#### Parameters

- `config`: OpenAPI 생성 설정 (선택사항)

#### Returns

OpenAPI 3.0 명세 객체

#### Example

```typescript
import { generateOpenAPI } from 'next-router';

export async function GET() {
  const spec = generateOpenAPI({
    info: {
      title: 'My API',
      version: '1.0.0',
      description: 'API documentation'
    },
    servers: [
      { url: 'https://api.example.com', description: 'Production' }
    ]
  });

  return NextResponse.json(spec);
}
```

### RouteRegistry

라우트 메타데이터를 관리하는 싱글톤 클래스입니다.

```typescript
class RouteRegistry {
  static getInstance(): RouteRegistry;
  registerRoute(path: string, method: string, metadata: RouteMetadata): void;
  getRoutes(): Map<string, RouteMetadata>;
  clear(): void;
}
```

#### Methods

- `getInstance`: 싱글톤 인스턴스를 반환합니다.
- `registerRoute`: 라우트를 등록합니다.
- `getRoutes`: 등록된 모든 라우트를 반환합니다.
- `clear`: 등록된 라우트들을 모두 삭제합니다.

---

## Utilities

### Validation

#### validateData

Zod 스키마를 사용하여 데이터를 검증합니다.

```typescript
function validateData<T>(
  schema: ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: ValidationError[] }
```

#### formatZodError

Zod 에러를 표준 형식으로 변환합니다.

```typescript
function formatZodError(error: ZodError): ValidationError[]
```

### Error Handling

#### createErrorResponse

표준 에러 응답을 생성합니다.

```typescript
function createErrorResponse(
  message: string,
  code: string,
  status: number,
  details?: any
): NextResponse
```

#### createValidationErrorResponse

검증 에러 응답을 생성합니다.

```typescript
function createValidationErrorResponse(
  errors: ValidationError[]
): NextResponse
```

---

## Type Definitions

### ValidationError

검증 에러 객체입니다.

```typescript
interface ValidationError {
  field: string;
  message: string;
  code: string;
}
```

### GenericUser

기본 사용자 인터페이스입니다.

```typescript
interface GenericUser {
  [key: string]: any;
}
```

### OpenAPIConfig

OpenAPI 설정 객체입니다.

```typescript
interface OpenAPIConfig {
  info: {
    title: string;
    version: string;
    description?: string;
  };
  servers?: Array<{
    url: string;
    description?: string;
  }>;
  components?: {
    securitySchemes?: Record<string, any>;
  };
}
```

### RouteMetadata

라우트 메타데이터 객체입니다.

```typescript
interface RouteMetadata {
  summary?: string;
  description?: string;
  tags?: string[];
  deprecated?: boolean;
  security?: Array<Record<string, string[]>>;
}
```

---

## Best Practices

1. **스키마 정의**: 모든 입력과 출력에 대해 Zod 스키마를 정의하세요.
2. **에러 처리**: 각 컨트롤러에 대해 적절한 에러 핸들러를 설정하세요.
3. **인증**: 보안이 필요한 라우트에는 반드시 인증을 설정하세요.
4. **응답 검증**: 개발 환경에서는 응답 검증을 활성화하세요.
5. **OpenAPI**: API 문서화를 위해 메타데이터를 적극 활용하세요.

---

## Migration Guide

기존 Next.js API Routes에서 `next-router`로 마이그레이션하는 방법은 [Migration Guide](migration.md)를 참조하세요.
