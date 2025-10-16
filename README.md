# next-router

🚀 **Spring Framework-style route wrapper for Next.js 15 App Router**

[![npm version](https://badge.fury.io/js/next-router.svg)](https://badge.fury.io/js/next-router)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tests](https://github.com/your-org/next-router/actions/workflows/test.yml/badge.svg)](https://github.com/your-org/next-router/actions/workflows/test.yml)
[![Coverage](https://codecov.io/gh/your-org/next-router/branch/main/graph/badge.svg)](https://codecov.io/gh/your-org/next-router)

Transform your Next.js API routes with Spring Framework-inspired patterns, automatic validation, type safety, and built-in OpenAPI documentation generation.

---

## ✨ Features

### 🔒 **Authentication & Authorization**
- **Provider Agnostic**: Works with NextAuth.js, Clerk, Supabase, custom JWT, and more
- **Role-based Access Control**: Fine-grained permission system
- **Automatic Token Validation**: Built-in authentication middleware

### 📝 **Automatic Validation**
- **Request Validation**: Query params, body, and path parameters
- **Response Validation**: Development-mode response schema validation
- **Zod Integration**: Leverages Zod for schema definition and validation
- **Type Inference**: Full TypeScript support with automatic type inference

### 🔧 **Developer Experience**
- **Spring-style API**: Familiar patterns for Java developers
- **Zero Configuration**: Works out of the box with sensible defaults
- **Error Handling**: Standardized error responses with custom handlers
- **Hot Reload**: Full Next.js development experience

### 📚 **Documentation**
- **OpenAPI Generation**: Automatic OpenAPI 3.0 spec generation
- **Swagger UI**: Built-in API documentation interface
- **Type-safe**: Generated types match your runtime behavior

---

## 🚀 Quick Start

### Installation

```bash
npm install next-router zod
# or
yarn add next-router zod
# or
pnpm add next-router zod
```

### Basic Usage

Create your first API route:

```typescript
// app/api/users/route.ts
import { NextResponse } from 'next/server';
import { createRoute } from 'next-router';
import { z } from 'zod';

// Define your schemas
const GetUsersQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

const UserResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  createdAt: z.string(),
});

// Create type-safe route
export const GET = createRoute({
  querySchema: GetUsersQuerySchema,
  responseSchema: z.object({
    users: z.array(UserResponseSchema),
    totalCount: z.number(),
  }),
  auth: false, // No auth required
}, async ({ query }) => {
  // query is automatically validated and typed!
  const { page, limit } = query!;

  const users = await getUsersFromDB(page, limit);

  return NextResponse.json({
    users,
    totalCount: users.length,
  });
});
```

### With Authentication

Set up authentication and create protected routes:

```typescript
// lib/auth.ts
import type { AuthProvider } from 'next-router';

const authProvider: AuthProvider<User> = {
  async authenticate(request) {
    const token = request.headers.get('authorization')?.slice(7);
    return await verifyToken(token);
  },
  async authorize(user, request) {
    return user.role === 'admin';
  },
  getRoles(user) {
    return [user.role];
  },
};

// lib/controller.ts
import { createController } from 'next-router';

export const controller = createController({
  auth: authProvider,
  onAuthError: () => NextResponse.json(
    { error: 'Unauthorized' },
    { status: 401 }
  ),
});

// app/api/admin/users/route.ts
export const POST = controller.post({
  bodySchema: CreateUserSchema,
  responseSchema: UserResponseSchema,
  auth: 'required', // Automatic authentication
}, async ({ body, user }) => {
  // body is validated, user is authenticated!
  const newUser = await createUser(body!, user!.id);
  return NextResponse.json(newUser, { status: 201 });
});
```

---

## 🎯 Why next-router?

### **Before (Standard Next.js)**
```typescript
export async function POST(request: Request) {
  // Manual auth check
  const token = request.headers.get('authorization');
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await verifyToken(token);
  if (!user) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  // Manual validation
  const body = await request.json();
  if (!body.email || !isValidEmail(body.email)) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
  }

  try {
    const result = await createUser(body);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

### **After (with next-router)**
```typescript
export const POST = controller.post({
  bodySchema: z.object({
    email: z.string().email(),
    name: z.string().min(1),
  }),
  responseSchema: UserSchema,
  auth: 'required',
}, async ({ body, user }) => {
  const result = await createUser(body!, user!.id);
  return NextResponse.json(result);
});
```

**✅ 90% less boilerplate code**
**✅ Automatic validation and type safety**
**✅ Built-in error handling**
**✅ Zero configuration authentication**

---

## 🔗 Authentication Providers

Works seamlessly with popular authentication solutions:

<table>
  <tr>
    <td align="center"><img src="https://next-auth.js.org/img/logo/logo-sm.png" width="48"><br><strong>NextAuth.js</strong></td>
    <td align="center"><img src="https://clerk.dev/logo.svg" width="48"><br><strong>Clerk</strong></td>
    <td align="center"><img src="https://supabase.com/docs/img/supabase-logo.svg" width="48"><br><strong>Supabase</strong></td>
    <td align="center">🔑<br><strong>Custom JWT</strong></td>
  </tr>
  <tr>
    <td><a href="examples/next-auth/">View Example</a></td>
    <td><a href="examples/clerk/">View Example</a></td>
    <td><a href="examples/supabase/">View Example</a></td>
    <td><a href="examples/custom-jwt/">View Example</a></td>
  </tr>
</table>

---

## 📖 Documentation

| Resource | Description |
|----------|-------------|
| **[Getting Started](docs/getting-started.md)** | Step-by-step setup guide |
| **[API Reference](docs/api-reference.md)** | Complete API documentation |
| **[Migration Guide](docs/migration.md)** | Migrate from existing Next.js APIs |
| **[Best Practices](docs/best-practices.md)** | Production-ready patterns |
| **[Examples](examples/)** | Real-world implementation examples |

---

## 🏗️ Core Concepts

### **Routes & Controllers**

```typescript
import { createController, createRoute } from 'next-router';

// Individual route
export const GET = createRoute({
  querySchema: QuerySchema,
  auth: 'required',
}, handler);

// Controller with shared configuration
const controller = createController({
  auth: authProvider,
  onAuthError: () => NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
});

export const POST = controller.post({ /* config */ }, handler);
export const PUT = controller.put({ /* config */ }, handler);
export const DELETE = controller.delete({ /* config */ }, handler);
```

### **Schema Validation**

```typescript
import { z } from 'zod';

// Request validation
const CreatePostSchema = z.object({
  title: z.string().min(5).max(100),
  content: z.string().min(10),
  tags: z.array(z.string()).max(5).optional(),
});

// Response validation (development mode)
const PostResponseSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  content: z.string(),
  createdAt: z.string().datetime(),
});

export const POST = createRoute({
  bodySchema: CreatePostSchema,
  responseSchema: PostResponseSchema,
  validateResponse: true,
}, async ({ body }) => {
  const post = await createPost(body!);
  return NextResponse.json(post);
});
```

### **OpenAPI Integration**

```typescript
// app/api/docs/route.ts
import { generateOpenAPI } from 'next-router';

export async function GET() {
  const spec = generateOpenAPI({
    info: {
      title: 'My API',
      version: '1.0.0',
    },
  });

  return NextResponse.json(spec);
}
```

Automatically generates OpenAPI 3.0 documentation from your route definitions!

---

## 💡 Advanced Usage

### **Custom Error Handling**

```typescript
const controller = createController({
  auth: authProvider,
  onValidationError: (errors) => {
    return NextResponse.json({
      error: 'Validation failed',
      details: errors.map(e => ({
        field: e.field,
        message: e.message,
      })),
    }, { status: 400 });
  },
  onInternalError: (error) => {
    console.error('API Error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      requestId: generateRequestId(),
    }, { status: 500 });
  },
});
```

### **Multiple Response Schemas**

```typescript
export const GET = createRoute({
  responseSchemas: {
    200: UserSchema,
    404: z.object({ error: z.string() }),
    500: z.object({ error: z.string(), code: z.string() }),
  },
}, async ({ params }) => {
  const user = await getUserById(params!.id);

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json(user); // Validates against UserSchema
});
```

### **Middleware Integration**

```typescript
// middleware.ts
import { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Add request ID
  request.headers.set('x-request-id', crypto.randomUUID());

  // Rate limiting
  if (isRateLimited(request)) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      { status: 429 }
    );
  }
}

export const config = {
  matcher: '/api/:path*',
};
```

---

## 🧪 Testing

```typescript
// tests/api/users.test.ts
import { describe, it, expect } from 'vitest';
import { testApiRoute } from 'next-router/testing';

describe('/api/users', () => {
  it('should create a user', async () => {
    const response = await testApiRoute(POST, {
      method: 'POST',
      body: { name: 'John', email: 'john@example.com' },
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      name: 'John',
      email: 'john@example.com',
    });
  });
});
```

---

## 📊 Comparison

| Feature | next-router | tRPC | Fastify | Express |
|---------|-------------|------|---------|---------|
| **Next.js 15 App Router** | ✅ | ❌ | ❌ | ❌ |
| **Zero Config** | ✅ | ❌ | ❌ | ❌ |
| **Spring-style API** | ✅ | ❌ | ❌ | ❌ |
| **Auto Type Inference** | ✅ | ✅ | ❌ | ❌ |
| **Request Validation** | ✅ | ✅ | 🔧 | 🔧 |
| **Response Validation** | ✅ | ✅ | ❌ | ❌ |
| **OpenAPI Generation** | ✅ | ❌ | 🔧 | 🔧 |
| **Auth Provider Agnostic** | ✅ | 🔧 | 🔧 | 🔧 |
| **Learning Curve** | 📖 Easy | 📚 Medium | 📚 Medium | 📖 Easy |

*✅ Built-in, ❌ Not supported, 🔧 Requires setup*

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/your-org/next-router.git
cd next-router

# Install dependencies
pnpm install

# Run tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Build the package
pnpm build

# Run examples
cd examples/basic-usage
pnpm dev
```

---

## 📝 License

MIT © [Your Name](https://github.com/your-org)

---

## 🌟 Show your support

Give a ⭐️ if this project helped you!

---

## 📢 Stay Updated

- 🐦 Follow us on [Twitter](https://twitter.com/your-handle)
- 💬 Join our [Discord](https://discord.gg/your-server)
- 📧 Subscribe to our [Newsletter](https://your-newsletter.com)

---

<div align="center">

**[Documentation](docs/) • [Examples](examples/) • [Changelog](CHANGELOG.md) • [Roadmap](https://github.com/your-org/next-router/projects/1)**

Made with ❤️ by the next-router team

</div>
