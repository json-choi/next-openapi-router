# Implementation Plan

## next-router 구현 계획서

**Version:** 1.0.0  
**Last Updated:** October 17, 2025

---

## 🎯 Overview

이 문서는 `next-router` 라이브러리의 구현 계획을 단계별로 설명합니다.

---

## 📦 Phase 1: Project Setup (1-2 days)

### 1.1 Repository 초기화

```bash
# Repository 생성
mkdir next-router
cd next-router
git init
pnpm init

# TypeScript 설정
pnpm add -D typescript @types/node
pnpm add -D tsup # Build tool
pnpm add -D vitest @vitest/ui # Testing
pnpm add -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
pnpm add -D prettier
```

### 1.2 프로젝트 구조

```
next-router/
├── src/
│   ├── index.ts                    # Public API
│   ├── create-controller.ts        # Main factory
│   ├── route.ts               # Route wrapper
│   ├── types.ts                    # Type definitions
│   └── utils/
│       ├── validation.ts
│       ├── error.ts
│       └── type-helpers.ts
├── tests/
│   ├── create-controller.test.ts
│   ├── route.test.ts
│   └── integration.test.ts
├── examples/
│   ├── next-auth/
│   ├── clerk/
│   └── custom/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
└── README.md
```

### 1.3 package.json 설정

```json
{
    "name": "next-router",
    "version": "1.0.0",
    "description": "Spring Framework-style route wrapper for Next.js 15 App Router",
    "keywords": [
        "nextjs",
        "next15",
        "app-router",
        "controller",
        "validation",
        "zod",
        "typescript",
        "rest-api"
    ],
    "main": "./dist/index.js",
    "module": "./dist/index.mjs",
    "types": "./dist/index.d.ts",
    "exports": {
        ".": {
            "import": "./dist/index.mjs",
            "require": "./dist/index.js",
            "types": "./dist/index.d.ts"
        }
    },
    "files": ["dist"],
    "scripts": {
        "build": "tsup src/index.ts --format cjs,esm --dts",
        "dev": "tsup src/index.ts --format cjs,esm --dts --watch",
        "test": "vitest",
        "test:ui": "vitest --ui",
        "test:coverage": "vitest --coverage",
        "lint": "eslint src/**/*.ts",
        "format": "prettier --write \"src/**/*.ts\"",
        "prepublishOnly": "pnpm build"
    },
    "peerDependencies": {
        "next": ">=15.0.0",
        "zod": ">=3.0.0"
    },
    "devDependencies": {
        "@types/node": "^20.0.0",
        "next": "^15.0.0",
        "typescript": "^5.3.0",
        "tsup": "^8.0.0",
        "vitest": "^1.0.0",
        "zod": "^3.22.0"
    },
    "engines": {
        "node": ">=18.17.0"
    }
}
```

### 1.4 TypeScript 설정 (tsconfig.json)

```json
{
    "compilerOptions": {
        "target": "ES2022",
        "module": "ESNext",
        "lib": ["ES2022"],
        "moduleResolution": "bundler",
        "declaration": true,
        "declarationMap": true,
        "sourceMap": true,
        "outDir": "./dist",
        "rootDir": "./src",
        "strict": true,
        "esModuleInterop": true,
        "skipLibCheck": true,
        "forceConsistentCasingInFileNames": true,
        "resolveJsonModule": true,
        "isolatedModules": true,
        "noUnusedLocals": true,
        "noUnusedParameters": true,
        "noImplicitReturns": true,
        "noFallthroughCasesInSwitch": true
    },
    "include": ["src/**/*"],
    "exclude": ["node_modules", "dist", "tests", "examples"]
}
```

---

## 🏗️ Phase 2: Core Implementation (3-5 days)

### 2.1 타입 정의 (src/types.ts)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { ZodSchema } from "zod";

/**
 * Generic user type that can be customized
 */
export type GenericUser = Record<string, any>;

/**
 * Authentication session getter
 */
export interface AuthProvider<TUser = GenericUser> {
    getSession: () => Promise<TUser | null>;
}

/**
 * Controller configuration
 */
export interface ControllerConfig<TUser = GenericUser> {
    auth?: AuthProvider<TUser>;
    onAuthError?: () => NextResponse;
    onValidationError?: (errors: ValidationError[]) => NextResponse;
    onInternalError?: (error: Error) => NextResponse;
}

/**
 * Route configuration
 */
export interface RouteConfig<TQuery = any, TBody = any, TParams = any> {
    auth?: "required" | "optional" | false;
    querySchema?: ZodSchema<TQuery>;
    bodySchema?: ZodSchema<TBody>;
    paramsSchema?: ZodSchema<TParams>;
}

/**
 * Route handler context
 */
export interface RouteContext<TQuery = any, TBody = any, TParams = any, TUser = GenericUser> {
    query: TQuery;
    body: TBody;
    params: TParams;
    user: TUser;
    request: NextRequest;
}

/**
 * Route handler function
 */
export type RouteHandler<TQuery = any, TBody = any, TParams = any, TUser = GenericUser> = (
    context: RouteContext<TQuery, TBody, TParams, TUser>
) => Promise<NextResponse | Response>;

/**
 * Next.js route handler
 */
export type NextRouteHandler = (
    request: NextRequest,
    context?: { params: Promise<Record<string, string>> }
) => Promise<NextResponse | Response>;

/**
 * Validation error
 */
export interface ValidationError {
    field: string;
    message: string;
}

/**
 * Standard error response
 */
export interface ErrorResponse {
    error: string;
    code: string;
    details?: ValidationError[];
}
```

### 2.2 Validation 유틸리티 (src/utils/validation.ts)

```typescript
import { ZodSchema, ZodError } from "zod";
import { ValidationError } from "../types";

export function validateData<T>(
    schema: ZodSchema<T>,
    data: unknown
): { success: true; data: T } | { success: false; errors: ValidationError[] } {
    const result = schema.safeParse(data);

    if (result.success) {
        return { success: true, data: result.data };
    }

    const errors: ValidationError[] = result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
    }));

    return { success: false, errors };
}

export function formatZodError(error: ZodError): ValidationError[] {
    return error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
    }));
}
```

### 2.3 Error 유틸리티 (src/utils/error.ts)

```typescript
import { NextResponse } from "next/server";
import { ValidationError, ErrorResponse } from "../types";

export function createErrorResponse(
    message: string,
    code: string,
    status: number,
    details?: ValidationError[]
): NextResponse {
    const body: ErrorResponse = {
        error: message,
        code,
        ...(details && { details }),
    };

    return NextResponse.json(body, { status });
}

export function createAuthError(): NextResponse {
    return createErrorResponse("Unauthorized", "AUTH_REQUIRED", 401);
}

export function createValidationError(message: string, details: ValidationError[]): NextResponse {
    return createErrorResponse(message, "VALIDATION_ERROR", 400, details);
}

export function createInternalError(): NextResponse {
    return createErrorResponse("Internal server error", "INTERNAL_ERROR", 500);
}

export function createParseError(): NextResponse {
    return createErrorResponse("Invalid JSON body", "PARSE_ERROR", 400);
}
```

### 2.4 createController 구현 (src/create-controller.ts)

```typescript
import { ControllerConfig, RouteHandler, NextRouteHandler, RouteConfig } from "./types";
import { createRoute } from "./route";

export function createController<TUser = any>(config: ControllerConfig<TUser> = {}) {
    const route = <TQuery = any, TBody = any, TParams = any>(
        handler: RouteHandler<TQuery, TBody, TParams, TUser>,
        routeConfig: RouteConfig<TQuery, TBody, TParams> = {}
    ): NextRouteHandler => {
        return createRoute<TQuery, TBody, TParams, TUser>(handler, routeConfig, config);
    };

    return { route };
}
```

### 2.5 route 구현 (src/route.ts)

```typescript
import { NextRequest, NextResponse } from "next/server";
import {
    ControllerConfig,
    RouteHandler,
    RouteConfig,
    NextRouteHandler,
    RouteContext,
} from "./types";
import { validateData } from "./utils/validation";
import {
    createAuthError,
    createValidationError,
    createParseError,
    createInternalError,
} from "./utils/error";

export function createRoute<TQuery, TBody, TParams, TUser>(
    handler: RouteHandler<TQuery, TBody, TParams, TUser>,
    routeConfig: RouteConfig<TQuery, TBody, TParams>,
    controllerConfig: ControllerConfig<TUser>
): NextRouteHandler {
    return async (
        request: NextRequest,
        context?: { params: Promise<Record<string, string>> }
    ): Promise<NextResponse | Response> => {
        try {
            // 1. Authentication
            let user: TUser | null = null;

            if (controllerConfig.auth) {
                user = await controllerConfig.auth.getSession();

                if (routeConfig.auth === "required" && !user) {
                    return controllerConfig.onAuthError?.() ?? createAuthError();
                }
            }

            // 2. Query parameters validation
            const url = new URL(request.url);
            const queryParams = Object.fromEntries(url.searchParams.entries());
            let validatedQuery = queryParams as TQuery;

            if (routeConfig.querySchema) {
                const result = validateData(routeConfig.querySchema, queryParams);
                if (!result.success) {
                    return (
                        controllerConfig.onValidationError?.(result.errors) ??
                        createValidationError("Invalid query parameters", result.errors)
                    );
                }
                validatedQuery = result.data;
            }

            // 3. Request body validation
            let validatedBody: TBody = null as TBody;

            if (routeConfig.bodySchema && ["POST", "PUT", "PATCH"].includes(request.method)) {
                try {
                    const rawBody = await request.json();
                    const result = validateData(routeConfig.bodySchema, rawBody);

                    if (!result.success) {
                        return (
                            controllerConfig.onValidationError?.(result.errors) ??
                            createValidationError("Invalid request body", result.errors)
                        );
                    }
                    validatedBody = result.data as TBody;
                } catch {
                    return createParseError();
                }
            }

            // 4. Path parameters validation
            let validatedParams = {} as TParams;

            if (context?.params) {
                const resolvedParams = await context.params;

                if (routeConfig.paramsSchema) {
                    const result = validateData(routeConfig.paramsSchema, resolvedParams);
                    if (!result.success) {
                        return (
                            controllerConfig.onValidationError?.(result.errors) ??
                            createValidationError("Invalid path parameters", result.errors)
                        );
                    }
                    validatedParams = result.data;
                } else {
                    validatedParams = resolvedParams as TParams;
                }
            }

            // 5. Execute handler
            const handlerContext: RouteContext<TQuery, TBody, TParams, TUser> = {
                query: validatedQuery,
                body: validatedBody,
                params: validatedParams,
                user: user as TUser,
                request,
            };

            return await handler(handlerContext);
        } catch (error) {
            console.error("Route handler error:", error);
            return controllerConfig.onInternalError?.(error as Error) ?? createInternalError();
        }
    };
}
```

### 2.6 Public API (src/index.ts)

```typescript
export { createController } from "./create-controller";
export type {
    ControllerConfig,
    RouteConfig,
    RouteContext,
    RouteHandler,
    AuthProvider,
    ValidationError,
    ErrorResponse,
    GenericUser,
} from "./types";
```

---

## 🧪 Phase 3: Testing (2-3 days)

### 3.1 Test Setup (vitest.config.ts)

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        globals: true,
        environment: "node",
        coverage: {
            provider: "v8",
            reporter: ["text", "json", "html"],
            exclude: ["node_modules/", "dist/", "tests/"],
        },
    },
});
```

### 3.2 Unit Tests

#### tests/validation.test.ts

```typescript
import { describe, it, expect } from "vitest";
import { z } from "zod";
import { validateData } from "../src/utils/validation";

describe("validateData", () => {
    it("should validate correct data", () => {
        const schema = z.object({
            email: z.string().email(),
            age: z.number(),
        });

        const result = validateData(schema, {
            email: "test@example.com",
            age: 25,
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.email).toBe("test@example.com");
            expect(result.data.age).toBe(25);
        }
    });

    it("should return errors for invalid data", () => {
        const schema = z.object({
            email: z.string().email(),
            age: z.number(),
        });

        const result = validateData(schema, {
            email: "invalid-email",
            age: "not-a-number",
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.errors).toHaveLength(2);
            expect(result.errors[0].field).toBe("email");
            expect(result.errors[1].field).toBe("age");
        }
    });
});
```

#### tests/create-controller.test.ts

```typescript
import { describe, it, expect, vi } from "vitest";
import { createController } from "../src/create-controller";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

describe("createController", () => {
    it("should create route function", () => {
        const { route } = createController();
        expect(typeof route).toBe("function");
    });

    it("should handle auth required", async () => {
        const mockGetSession = vi.fn().mockResolvedValue(null);
        const { route } = createController({
            auth: { getSession: mockGetSession },
        });

        const handler = route(
            async ({ user }) => {
                return NextResponse.json({ userId: user.id });
            },
            { auth: "required" }
        );

        const request = new NextRequest("http://localhost/api/test");
        const response = await handler(request);
        const body = await response.json();

        expect(response.status).toBe(401);
        expect(body.code).toBe("AUTH_REQUIRED");
    });

    it("should validate query parameters", async () => {
        const { route } = createController();

        const querySchema = z.object({
            page: z.coerce.number(),
        });

        const handler = route(
            async ({ query }) => {
                return NextResponse.json({ page: query.page });
            },
            { querySchema }
        );

        const request = new NextRequest("http://localhost/api/test?page=5");
        const response = await handler(request);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.page).toBe(5);
    });

    it("should return validation error for invalid query", async () => {
        const { route } = createController();

        const querySchema = z.object({
            page: z.coerce.number().min(1),
        });

        const handler = route(
            async ({ query }) => {
                return NextResponse.json({ page: query.page });
            },
            { querySchema }
        );

        const request = new NextRequest("http://localhost/api/test?page=0");
        const response = await handler(request);
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.code).toBe("VALIDATION_ERROR");
    });
});
```

### 3.3 Integration Tests

#### tests/integration.test.ts

```typescript
import { describe, it, expect, vi } from "vitest";
import { createController } from "../src";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

describe("Integration Tests", () => {
    it("should handle full request lifecycle", async () => {
        const mockUser = { id: "user-123", email: "test@example.com" };
        const mockGetSession = vi.fn().mockResolvedValue(mockUser);

        const { route } = createController({
            auth: { getSession: mockGetSession },
        });

        const bodySchema = z.object({
            name: z.string().min(2),
            age: z.number().min(18),
        });

        const handler = route(
            async ({ body, user }) => {
                return NextResponse.json({
                    userId: user.id,
                    name: body.name,
                    age: body.age,
                });
            },
            {
                auth: "required",
                bodySchema,
            }
        );

        const request = new NextRequest("http://localhost/api/users", {
            method: "POST",
            body: JSON.stringify({ name: "John Doe", age: 25 }),
            headers: { "Content-Type": "application/json" },
        });

        const response = await handler(request);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.userId).toBe("user-123");
        expect(body.name).toBe("John Doe");
        expect(body.age).toBe(25);
    });
});
```

---

## 📚 Phase 4: Examples & Documentation (2-3 days)

### 4.1 Example: NextAuth.js

```typescript
// examples/next-auth/lib/controller.ts
import { createController } from "next-router";
import { auth } from "@/auth";

interface User {
    id: string;
    email: string;
    name: string;
}

export const { route } = createController<User>({
    auth: {
        getSession: async () => {
            const session = await auth();
            if (!session?.user) return null;
            return {
                id: session.user.id!,
                email: session.user.email!,
                name: session.user.name!,
            };
        },
    },
});

// examples/next-auth/app/api/users/route.ts
import { route } from "@/lib/controller";
import { z } from "zod";
import { NextResponse } from "next/server";

const UserQuerySchema = z.object({
    page: z.coerce.number().default(1),
    limit: z.coerce.number().default(10),
});

export const GET = route(
    async ({ query, user }) => {
        const users = await db.user.findMany({
            skip: (query.page - 1) * query.limit,
            take: query.limit,
        });
        return NextResponse.json(users);
    },
    {
        auth: "required",
        querySchema: UserQuerySchema,
    }
);
```

### 4.2 Example: Clerk

```typescript
// examples/clerk/lib/controller.ts
import { createController } from "next-router";
import { auth, currentUser } from "@clerk/nextjs/server";

interface User {
    id: string;
    email: string;
}

export const { route } = createController<User>({
    auth: {
        getSession: async () => {
            const { userId } = await auth();
            if (!userId) return null;

            const user = await currentUser();
            if (!user) return null;

            return {
                id: userId,
                email: user.emailAddresses[0]?.emailAddress ?? "",
            };
        },
    },
});
```

### 4.3 Example: Custom Auth

```typescript
// examples/custom/lib/controller.ts
import { createController } from "next-router";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/jwt";

interface User {
    id: string;
    email: string;
    role: string;
}

export const { route } = createController<User>({
    auth: {
        getSession: async () => {
            const cookieStore = await cookies();
            const token = cookieStore.get("auth-token")?.value;

            if (!token) return null;

            try {
                const payload = await verifyJWT(token);
                return {
                    id: payload.userId,
                    email: payload.email,
                    role: payload.role,
                };
            } catch {
                return null;
            }
        },
    },
});
```

### 4.4 Documentation Structure

```
docs/
├── getting-started.md          # 시작 가이드
├── installation.md             # 설치 방법
├── api-reference.md            # API 문서
├── providers/
│   ├── next-auth.md           # NextAuth 가이드
│   ├── clerk.md               # Clerk 가이드
│   ├── supabase.md            # Supabase 가이드
│   └── custom.md              # 커스텀 auth 가이드
├── guides/
│   ├── validation.md          # 검증 가이드
│   ├── error-handling.md      # 에러 처리
│   ├── type-safety.md         # 타입 안전성
│   └── best-practices.md      # 베스트 프랙티스
├── examples/
│   ├── crud-api.md            # CRUD API 예제
│   ├── file-upload.md         # 파일 업로드
│   └── pagination.md          # 페이지네이션
└── migration/
    └── from-manual-auth.md    # 기존 코드 마이그레이션
```

---

## 🚀 Phase 5: Release Preparation (1-2 days)

### 5.1 README.md

````markdown
# next-router

Spring Framework-style route wrapper for Next.js 15 App Router

## Features

-   🔒 **Auth Library Agnostic**: Works with NextAuth, Clerk, Supabase, or custom auth
-   ✅ **Automatic Validation**: Zod schema validation for query, body, params
-   🎯 **Type-safe**: Full TypeScript type inference
-   🚀 **Great DX**: Minimal boilerplate

## Installation

```bash
pnpm add next-router zod
```
````

## Quick Start

```typescript
// lib/controller.ts
import { createController } from "next-router";
import { auth } from "@/auth";

export const { route } = createController({
    auth: {
        getSession: async () => {
            const session = await auth();
            return session?.user ?? null;
        },
    },
});

// app/api/users/route.ts
import { route } from "@/lib/controller";
import { z } from "zod";

export const GET = route(
    async ({ query, user }) => {
        const users = await UserService.list(query.page);
        return NextResponse.json(users);
    },
    {
        auth: "required",
        querySchema: z.object({
            page: z.coerce.number().default(1),
        }),
    }
);
```

## Documentation

-   [Getting Started](docs/getting-started.md)
-   [API Reference](docs/api-reference.md)
-   [Examples](examples/)

## License

MIT

````

### 5.2 CHANGELOG.md

```markdown
# Changelog

## [1.0.0] - 2025-10-17

### Added
- Initial release
- `createController()` factory function
- `route()` wrapper
- Query, body, params validation
- Authentication abstraction
- TypeScript type safety
- Error handling
````

### 5.3 Pre-publish Checklist

-   [ ] All tests passing (`pnpm test`)
-   [ ] 90%+ test coverage
-   [ ] Build successful (`pnpm build`)
-   [ ] Lint passing (`pnpm lint`)
-   [ ] README complete
-   [ ] Examples working
-   [ ] API docs complete
-   [ ] CHANGELOG updated
-   [ ] License file (MIT)
-   [ ] package.json metadata correct

---

## 📢 Phase 6: Launch & Marketing (1-2 days)

### 6.1 npm 배포

```bash
# 최종 빌드
pnpm build

# 배포
npm publish --access public
```

### 6.2 GitHub Repository

-   [ ] README badges (npm version, downloads, license)
-   [ ] GitHub topics 추가
-   [ ] Issue templates 생성
-   [ ] Pull request template
-   [ ] Contributing guidelines
-   [ ] Code of conduct

### 6.3 커뮤니티 공개

**Reddit:**

-   r/nextjs
-   r/typescript
-   r/webdev

**X (Twitter):**

```
🚀 Introducing next-router!

Spring Framework-style route wrapper for Next.js 15 App Router

✅ Auth library agnostic
✅ Zod validation
✅ Type-safe
✅ Minimal boilerplate

Check it out: [link]

#nextjs #typescript #webdev
```

**Dev.to 블로그 포스트:**
제목: "Building Type-safe APIs in Next.js 15 with next-router"

**Next.js Discord:**
#show-and-tell 채널에 공유

---

## 🎯 Success Criteria

### Week 1

-   [ ] 프로젝트 setup 완료
-   [ ] Core 기능 구현 완료
-   [ ] 기본 테스트 작성

### Week 2

-   [ ] 모든 provider 예제 완료
-   [ ] 문서 작성 완료
-   [ ] npm 배포

### Month 1

-   [ ] 100+ npm downloads
-   [ ] 50+ GitHub stars
-   [ ] 5+ issues/discussions
-   [ ] 0 critical bugs

### Month 3

-   [ ] 500+ npm downloads
-   [ ] 200+ GitHub stars
-   [ ] 3+ contributors
-   [ ] 1+ production user testimonial

---

## 📝 Notes

### 개발 우선순위

1. Core functionality (createController, route)
2. Type safety & inference
3. Error handling
4. Documentation
5. Examples
6. Testing

### 품질 기준

-   TypeScript strict mode
-   90%+ test coverage
-   Zero any types
-   ESLint + Prettier
-   Semantic versioning

### 커뮤니티

-   Respectful & welcoming
-   Clear contribution guidelines
-   Fast issue response (<48h)
-   Regular updates
