# Clerk Integration Example

이 예제는 `next-router`를 Clerk와 함께 사용하는 방법을 보여줍니다.

## Setup

1. 의존성 설치:
```bash
npm install @clerk/nextjs @clerk/clerk-sdk-node
```

2. 환경변수 설정 (`.env.local`):
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_publishable_key
CLERK_SECRET_KEY=sk_test_your_secret_key
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/
```

3. Clerk 설정 (`app/layout.tsx` 및 `middleware.ts` 참조)

4. API routes 사용 (`app/api/users/route.ts`, `app/api/posts/route.ts` 참조)

## Features

- Clerk session 기반 인증
- JWT token 검증
- 사용자 메타데이터 접근
- 조직(Organization) 및 역할 기반 접근 제어
- Webhook 지원

## File Structure

```
examples/clerk/
├── README.md
├── package.json
├── middleware.ts
├── .env.local.example
├── app/
│   ├── layout.tsx
│   ├── api/
│   │   ├── users/
│   │   │   └── route.ts
│   │   └── posts/
│   │       └── route.ts
│   └── lib/
│       ├── auth.ts
│       └── controller.ts
```

## Usage

```typescript
// lib/controller.ts
import { createController } from 'next-router';
import { clerkProvider } from './auth';

const controller = createController({
  auth: clerkProvider
});

// API route
export const GET = controller.get({
  auth: 'required',
  responseSchema: UserSchema
}, async ({ user }) => {
  return NextResponse.json({ user });
});
```

## Organization & Roles

Clerk은 조직 및 역할 기반 접근 제어를 지원합니다:

```typescript
export const GET = controller.get({
  auth: 'required'
}, async ({ user }) => {
  // 조직 멤버십 확인
  if (user.organizationRole === 'admin') {
    // 관리자만 접근 가능
  }
});
