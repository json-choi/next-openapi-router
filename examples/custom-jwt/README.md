# Custom JWT Auth Integration Example

이 예제는 `next-router`를 Custom JWT Authentication과 함께 사용하는 방법을 보여줍니다.

## Setup

1. 의존성 설치:
```bash
npm install jsonwebtoken bcryptjs
npm install -D @types/jsonwebtoken @types/bcryptjs
```

2. 환경변수 설정 (`.env.local`):
```
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=24h
BCRYPT_SALT_ROUNDS=10
```

3. Auth 설정 (`lib/auth.ts` 참조)

4. API routes 사용 (`app/api/auth/login/route.ts`, `app/api/users/route.ts` 참조)

## Features

- Custom JWT 토큰 생성 및 검증
- bcrypt를 사용한 패스워드 해싱
- 토큰 만료 처리
- 리프레시 토큰 지원 (선택사항)
- 역할 기반 접근 제어
- 사용자 정의 클레임 지원

## File Structure

```
examples/custom-jwt/
├── README.md
├── package.json
├── .env.local.example
├── app/
│   └── api/
│       ├── auth/
│       │   ├── login/
│       │   │   └── route.ts
│       │   ├── register/
│       │   │   └── route.ts
│       │   └── refresh/
│       │       └── route.ts
│       └── users/
│           └── route.ts
└── lib/
    ├── auth.ts
    ├── controller.ts
    ├── jwt.ts
    └── users.ts
```

## Usage

```typescript
// lib/controller.ts
import { createController } from 'next-router';
import { jwtProvider } from './auth';

const controller = createController({
  auth: jwtProvider
});

// API route
export const GET = controller.get({
  auth: 'required',
  responseSchema: UserSchema
}, async ({ user }) => {
  return NextResponse.json({ user });
});
```

## Token Structure

JWT 토큰은 다음과 같은 구조를 가집니다:

```json
{
  "sub": "user_id",
  "email": "user@example.com",
  "role": "admin",
  "permissions": ["read", "write"],
  "iat": 1234567890,
  "exp": 1234567890
}
```

## Authentication Flow

1. **Registration**: POST `/api/auth/register`
2. **Login**: POST `/api/auth/login` → JWT 토큰 반환
3. **API Request**: Header에 `Authorization: Bearer <token>` 포함
4. **Token Verification**: 미들웨어에서 토큰 검증
5. **Refresh**: POST `/api/auth/refresh` (선택사항)

## Security Best Practices

- JWT secret은 안전하게 관리
- 토큰 만료 시간 적절히 설정
- HTTPS 사용 필수
- XSS/CSRF 공격 방지
- Rate limiting 구현
