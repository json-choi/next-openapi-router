# Product Requirements Document (PRD)

## next-router

**Version:** 1.0.0  
**Author:** Jaesong Choe  
**Last Updated:** October 17, 2025

---

## 📋 Executive Summary

`next-router`는 Spring Framework의 `@RestController` 스타일을 Next.js 15 App Router에 도입하는 타입 안전한 route wrapper 라이브러리입니다.

**핵심 가치:**

-   🔒 **인증 라이브러리 독립성**: NextAuth, Clerk, Supabase 등 어떤 인증 시스템과도 통합 가능
-   ✅ **자동 검증**: Zod 스키마 기반 요청 검증 (query, body, params)
-   🎯 **타입 안전성**: 완벽한 TypeScript 타입 추론
-   🚀 **개발자 경험**: 보일러플레이트 코드 최소화

---

## 🎯 Problem Statement

### 현재 Next.js App Router의 문제점

1. **반복적인 인증 코드**

```typescript
// 모든 route에서 반복
const session = await auth();
if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

2. **수동 요청 검증**

```typescript
// 매번 수동으로 검증
const body = await request.json();
const result = schema.safeParse(body);
if (!result.success) {
    // 에러 처리 로직 반복...
}
```

3. **타입 안전성 부족**

```typescript
// 타입이 보장되지 않음
const { searchParams } = new URL(request.url);
const page = searchParams.get("page"); // string | null
```

4. **에러 처리 중복**

```typescript
// 모든 route에서 try-catch 반복
try {
    // 로직...
} catch (error) {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
}
```

### 해결 방안

Spring Framework의 검증된 패턴을 Next.js에 도입하여:

-   선언적 인증 처리 (`auth: 'required'`)
-   자동 요청 검증 (`bodySchema`, `querySchema`, `paramsSchema`)
-   타입 안전한 컨텍스트 (`{ body, query, params, user }`)
-   통합 에러 핸들링

---

## 👥 Target Users

### Primary Users

1. **Full-stack TypeScript 개발자**

    - Next.js App Router를 사용하는 개발자
    - 타입 안전성을 중요하게 생각하는 개발자
    - Spring Framework 경험이 있는 개발자

2. **스타트업 / 스케일업 팀**
    - 빠른 MVP 개발이 필요한 팀
    - 코드 품질과 유지보수성을 중요시하는 팀
    - API 개발 생산성을 높이고 싶은 팀

### Secondary Users

1. **오픈소스 컨트리뷰터**
    - Next.js 생태계에 기여하고 싶은 개발자
    - 라이브러리 개발 경험을 쌓고 싶은 개발자

---

## 🎨 Core Features

### 1. Authentication Abstraction (인증 추상화)

**요구사항:**

-   다양한 인증 라이브러리와 호환
-   초기 설정을 통한 auth provider 주입
-   타입 안전한 User 객체

**사용 예시:**

```typescript
// app/config/controller.ts
import { createController } from "next-router";
import { auth } from "@/lib/auth"; // NextAuth, Clerk, Supabase 등

export const { route } = createController({
    auth: {
        getSession: async () => {
            const session = await auth();
            return session?.user ?? null;
        },
    },
});
```

### 2. Request Validation (요청 검증)

**요구사항:**

-   Zod 스키마 기반 검증
-   Query parameters, Request body, Path parameters 지원
-   상세한 검증 에러 메시지

**사용 예시:**

```typescript
export const POST = route(
    async ({ body, user }) => {
        // body는 이미 검증되고 타입이 보장됨
        const newUser = await UserService.create(body);
        return NextResponse.json(newUser);
    },
    {
        auth: "required",
        bodySchema: z.object({
            email: z.string().email(),
            name: z.string().min(2),
        }),
    }
);
```

### 3. Type-safe Context (타입 안전 컨텍스트)

**요구사항:**

-   완벽한 TypeScript 타입 추론
-   스키마로부터 자동 타입 생성
-   IDE 자동완성 지원

**사용 예시:**

```typescript
const querySchema = z.object({
    page: z.coerce.number(),
    search: z.string().optional(),
});

export const GET = route(
    async ({ query }) => {
        query.page; // number 타입 (자동 추론)
        query.search; // string | undefined 타입 (자동 추론)
    },
    { querySchema }
);
```

### 4. Unified Error Handling (통합 에러 처리)

**요구사항:**

-   일관된 에러 응답 포맷
-   커스터마이징 가능한 에러 핸들러
-   개발/프로덕션 환경별 에러 메시지

**에러 응답 포맷:**

```typescript
{
  error: string;        // 에러 메시지
  code: string;         // 에러 코드
  details?: Array<{     // 검증 에러 상세 (optional)
    field: string;
    message: string;
  }>;
}
```

---

## 🔧 Technical Requirements

### Core Dependencies

-   **Next.js**: ≥ 15.0.0 (App Router)
-   **Zod**: ≥ 3.0.0 (Schema validation)
-   **TypeScript**: ≥ 5.0.0

### Peer Dependencies (Optional)

-   next-auth (NextAuth.js)
-   @clerk/nextjs (Clerk)
-   @supabase/auth-helpers-nextjs (Supabase)

### Runtime Support

-   **Node.js**: ≥ 18.17.0
-   **Runtime**: Node.js, Edge Runtime

---

## 🏗️ Architecture

### 1. Package Structure

```
next-router/
├── src/
│   ├── core/
│   │   ├── create-controller.ts    # 메인 팩토리 함수
│   │   ├── route.ts           # Route wrapper 로직
│   │   └── types.ts                # 공통 타입 정의
│   ├── providers/
│   │   ├── next-auth.ts            # NextAuth adapter
│   │   ├── clerk.ts                # Clerk adapter
│   │   ├── supabase.ts             # Supabase adapter
│   │   └── custom.ts               # 커스텀 adapter 헬퍼
│   ├── utils/
│   │   ├── validation.ts           # 검증 유틸리티
│   │   ├── error-handler.ts        # 에러 핸들링
│   │   └── type-helpers.ts         # 타입 헬퍼
│   └── index.ts                    # Public API exports
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── examples/
│   ├── next-auth/
│   ├── clerk/
│   ├── supabase/
│   └── custom-auth/
├── docs/
│   ├── getting-started.md
│   ├── api-reference.md
│   ├── providers.md
│   └── migration-guide.md
├── package.json
├── tsconfig.json
└── README.md
```

### 2. API Design

#### createController()

```typescript
interface ControllerConfig<TUser = any> {
    auth?: {
        getSession: () => Promise<TUser | null>;
    };
    errorHandler?: (error: Error) => NextResponse;
    onValidationError?: (errors: ValidationError[]) => NextResponse;
}

function createController<TUser = any>(
    config?: ControllerConfig<TUser>
): {
    route: <TQuery, TBody, TParams>(
        handler: RouteHandler<TQuery, TBody, TParams, TUser>,
        routeConfig?: RouteConfig<TQuery, TBody, TParams>
    ) => NextRouteHandler;
};
```

#### route()

```typescript
interface RouteConfig<TQuery, TBody, TParams> {
    auth?: "required" | "optional" | false;
    querySchema?: ZodSchema<TQuery>;
    bodySchema?: ZodSchema<TBody>;
    paramsSchema?: ZodSchema<TParams>;
}

interface RouteContext<TQuery, TBody, TParams, TUser> {
    query: TQuery;
    body: TBody;
    params: TParams;
    user: TUser;
    request: NextRequest;
}

type RouteHandler<TQuery, TBody, TParams, TUser> = (
    context: RouteContext<TQuery, TBody, TParams, TUser>
) => Promise<NextResponse | Response>;
```

---

## 🚀 Use Cases

### Use Case 1: NextAuth.js 통합

```typescript
// lib/controller.ts
import { createController } from "next-router";
import { auth } from "@/auth"; // NextAuth v5

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

export const GET = route(
    async ({ query, user }) => {
        const users = await UserService.list(query.page);
        return NextResponse.json(users);
    },
    {
        auth: "required",
        querySchema: z.object({ page: z.coerce.number().default(1) }),
    }
);
```

### Use Case 2: Clerk 통합

```typescript
// lib/controller.ts
import { createController } from "next-router";
import { auth } from "@clerk/nextjs/server";

export const { route } = createController({
    auth: {
        getSession: async () => {
            const { userId } = await auth();
            if (!userId) return null;
            return { id: userId };
        },
    },
});
```

### Use Case 3: 커스텀 인증 시스템

```typescript
// lib/controller.ts
import { createController } from "next-router";
import { verifyJWT } from "@/lib/jwt";

export const { route } = createController({
    auth: {
        getSession: async () => {
            const token = cookies().get("auth-token")?.value;
            if (!token) return null;

            try {
                const payload = await verifyJWT(token);
                return { id: payload.userId, email: payload.email };
            } catch {
                return null;
            }
        },
    },
});
```

### Use Case 4: 인증 없는 사용 (Validation만)

```typescript
// lib/controller.ts
import { createController } from "next-router";

// auth 설정 없이 생성
export const { route } = createController();

// app/api/public/route.ts
export const POST = route(
    async ({ body }) => {
        // 인증 없이 validation만 사용
        return NextResponse.json({ success: true });
    },
    {
        auth: false,
        bodySchema: ContactFormSchema,
    }
);
```

---

## 📊 Success Metrics

### Launch Criteria (v1.0.0)

-   [ ] 100% TypeScript 타입 커버리지
-   [ ] 90% 이상 테스트 커버리지
-   [ ] 3개 이상의 auth provider 예제
-   [ ] 완전한 문서화 (Getting Started, API Reference, Migration Guide)

### KPIs (6개월 후)

-   **Adoption**: npm weekly downloads > 1,000
-   **Quality**: GitHub stars > 500
-   **Reliability**: <5 critical bugs
-   **Community**: 10+ contributors
-   **Documentation**: 95%+ 문서 만족도

---

## 🗓️ Roadmap

### Phase 1: MVP (Week 1-2)

-   [x] Core architecture design
-   [ ] `createController()` 구현
-   [ ] `route()` 구현
-   [ ] NextAuth adapter 구현
-   [ ] 기본 문서 작성

### Phase 2: Provider Support (Week 3-4)

-   [ ] Clerk adapter 구현
-   [ ] Supabase adapter 구현
-   [ ] Custom auth helper 구현
-   [ ] 각 provider별 예제 작성

### Phase 3: Testing & Documentation (Week 5-6)

-   [ ] Unit tests (90% coverage)
-   [ ] Integration tests
-   [ ] E2E tests with real Next.js app
-   [ ] 완전한 API documentation
-   [ ] Migration guide

### Phase 4: Release & Marketing (Week 7-8)

-   [ ] npm 패키지 배포
-   [ ] GitHub repository 공개
-   [ ] README 작성 (한글/영문)
-   [ ] 커뮤니티 공개 (Reddit, X, Dev.to)
-   [ ] Next.js Discord에 공유

### Phase 5: Community Building (Week 9-12)

-   [ ] Issue triage 및 bug fixes
-   [ ] Feature requests 수집 및 우선순위 결정
-   [ ] Contribution guidelines 작성
-   [ ] 커뮤니티 피드백 반영

---

## 🎯 Future Enhancements (v2.0+)

### Advanced Features

1. **Middleware Support**

    ```typescript
    route(handler, {
        middlewares: [rateLimit(), cors(), logging()],
    });
    ```

2. **Response Transformation**

    ```typescript
    route(handler, {
        transform: {
            success: (data) => ({ success: true, data }),
            error: (error) => customErrorFormat(error),
        },
    });
    ```

3. **OpenAPI/Swagger 자동 생성**

    ```typescript
    route(handler, {
        openapi: {
            summary: "Get user list",
            tags: ["users"],
        },
    });
    ```

4. **Request/Response Logging**

    ```typescript
    createController({
        logging: {
            enabled: true,
            level: "info",
            redact: ["password", "token"],
        },
    });
    ```

5. **Rate Limiting**
    ```typescript
    route(handler, {
        rateLimit: {
            max: 100,
            window: "15m",
        },
    });
    ```

---

## 🤝 Community & Support

### Documentation

-   **Website**: https://next-router.dev
-   **GitHub**: https://github.com/your-org/next-router
-   **Docs**: https://next-router.dev/docs

### Support Channels

-   **GitHub Issues**: Bug reports & feature requests
-   **GitHub Discussions**: Q&A, ideas, showcase
-   **Discord**: Real-time community support

### Contributing

-   Contribution guidelines in CONTRIBUTING.md
-   Code of conduct in CODE_OF_CONDUCT.md
-   Development setup in DEVELOPMENT.md

---

## 📝 License

MIT License - Free for commercial and personal use

---

## 🙏 Acknowledgments

-   Inspired by Spring Framework's `@RestController`
-   Built for the Next.js community
-   Special thanks to early adopters and contributors

---

## 📞 Contact

**Maintainer**: Jaesong Choe  
**Email**: [your-email]  
**Twitter**: [@your-handle]  
**GitHub**: [@your-github]
