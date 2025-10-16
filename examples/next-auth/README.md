# NextAuth.js Integration Example

이 예제는 `next-router`를 NextAuth.js와 함께 사용하는 방법을 보여줍니다.

## Setup

1. 의존성 설치:
```bash
npm install next-auth @auth/core
```

2. 환경변수 설정 (`.env.local`):
```
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-here
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

3. NextAuth 설정 (`app/api/auth/[...nextauth]/route.ts` 참조)

4. API routes 사용 (`app/api/users/route.ts`, `app/api/posts/route.ts` 참조)

## Features

- NextAuth.js session 기반 인증
- Google OAuth 제공자
- 세션 기반 사용자 정보 추출
- 역할 기반 접근 제어
- 자동 토큰 갱신

## File Structure

```
examples/next-auth/
├── README.md
├── package.json
├── next.config.js
├── .env.local.example
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   └── [...nextauth]/
│   │   │       └── route.ts
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
import { nextAuthProvider } from './auth';

const controller = createController({
  auth: nextAuthProvider
});

// API route
export const GET = controller.get({
  auth: 'required',
  responseSchema: UserSchema
}, async ({ user }) => {
  return NextResponse.json({ user });
});
