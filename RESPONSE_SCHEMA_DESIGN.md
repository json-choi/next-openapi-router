# Response Schema & OpenAPI Design

## Overview

Response schema 기능을 추가하여:

1. **Response 타입 안전성** 확보
2. **Response 검증** (개발 환경)
3. **OpenAPI/Swagger 문서 자동 생성**

---

## 🎯 Core Features

### 1. Response Schema 정의

```typescript
import { route } from "@/lib/controller";
import { z } from "zod";

const UserResponseSchema = z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    name: z.string(),
    createdAt: z.string().datetime(),
});

export const GET = route(
    async ({ params }) => {
        const user = await UserService.findById(params.id);

        // 타입이 자동으로 추론됨
        return NextResponse.json({
            id: user.id,
            email: user.email,
            name: user.name,
            createdAt: user.createdAt.toISOString(),
        });
    },
    {
        auth: "required",
        paramsSchema: z.object({ id: z.string().uuid() }),
        responseSchema: UserResponseSchema, // ✅ Response schema 추가
    }
);
```

### 2. Response 타입 추론

```typescript
// Handler의 반환 타입이 자동으로 검증됨
export const GET = route(
    async ({ params }) => {
        // ❌ TypeScript 에러 발생
        return NextResponse.json({
            id: params.id,
            email: "invalid-email", // email 형식이 아님
            // name 필드 누락
        });
    },
    {
        responseSchema: UserResponseSchema,
    }
);
```

### 3. Multiple Response Schemas (HTTP Status별)

```typescript
const CreateUserResponseSchemas = {
    201: z.object({
        id: z.string().uuid(),
        email: z.string().email(),
        name: z.string(),
    }),
    400: z.object({
        error: z.string(),
        code: z.literal("VALIDATION_ERROR"),
        details: z.array(
            z.object({
                field: z.string(),
                message: z.string(),
            })
        ),
    }),
    409: z.object({
        error: z.string(),
        code: z.literal("DUPLICATE_EMAIL"),
    }),
};

export const POST = route(
    async ({ body }) => {
        const existing = await UserService.findByEmail(body.email);

        if (existing) {
            return NextResponse.json(
                { error: "Email already exists", code: "DUPLICATE_EMAIL" },
                { status: 409 }
            );
        }

        const user = await UserService.create(body);
        return NextResponse.json(
            { id: user.id, email: user.email, name: user.name },
            { status: 201 }
        );
    },
    {
        auth: "required",
        bodySchema: CreateUserSchema,
        responseSchemas: CreateUserResponseSchemas,
    }
);
```

### 4. OpenAPI 문서 자동 생성

```typescript
// lib/controller.ts
import { createController } from "next-router";

export const { route, generateOpenAPI } = createController({
    auth: {
        getSession: async () => {
            /* ... */
        },
    },
    openapi: {
        info: {
            title: "My API",
            version: "1.0.0",
            description: "API documentation",
        },
        servers: [
            { url: "https://api.example.com", description: "Production" },
            { url: "http://localhost:3000", description: "Development" },
        ],
    },
});

// app/api/openapi/route.ts
import { generateOpenAPI } from "@/lib/controller";
import { NextResponse } from "next/server";

export async function GET() {
    const spec = await generateOpenAPI();
    return NextResponse.json(spec);
}
```

### 5. Route Metadata (OpenAPI용)

```typescript
export const GET = route(
    async ({ query }) => {
        const users = await UserService.list(query.page, query.limit);
        return NextResponse.json(users);
    },
    {
        auth: "required",
        querySchema: z.object({
            page: z.coerce.number().default(1),
            limit: z.coerce.number().default(10),
        }),
        responseSchema: z.object({
            data: z.array(UserSchema),
            total: z.number(),
            page: z.number(),
        }),
        metadata: {
            operationId: "listUsers",
            summary: "Get list of users",
            description: "Returns paginated list of users",
            tags: ["users"],
        },
    }
);
```

---

## 🏗️ Implementation

### Type Definitions Update

```typescript
// src/types.ts

/**
 * Route configuration with response schema
 */
export interface RouteConfig<TQuery = any, TBody = any, TParams = any, TResponse = any> {
    auth?: "required" | "optional" | false;
    querySchema?: ZodSchema<TQuery>;
    bodySchema?: ZodSchema<TBody>;
    paramsSchema?: ZodSchema<TParams>;

    // Response schema (single or by status code)
    responseSchema?: ZodSchema<TResponse>;
    responseSchemas?: Record<number, ZodSchema<any>>;

    // Validate response in development
    validateResponse?: boolean; // default: process.env.NODE_ENV === 'development'

    // OpenAPI metadata
    metadata?: RouteMetadata;
}

/**
 * OpenAPI metadata
 */
export interface RouteMetadata {
    operationId?: string;
    summary?: string;
    description?: string;
    tags?: string[];
    deprecated?: boolean;
    security?: Array<Record<string, string[]>>;
}

/**
 * OpenAPI configuration
 */
export interface OpenAPIConfig {
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

/**
 * Controller configuration with OpenAPI
 */
export interface ControllerConfig<TUser = GenericUser> {
    auth?: AuthProvider<TUser>;
    onAuthError?: () => NextResponse;
    onValidationError?: (errors: ValidationError[]) => NextResponse;
    onInternalError?: (error: Error) => NextResponse;
    openapi?: OpenAPIConfig;
}
```

### Response Validation Logic

```typescript
// src/utils/response-validation.ts
import { ZodSchema } from "zod";
import { ValidationError } from "../types";

export function validateResponse(
    schema: ZodSchema<any>,
    data: any,
    status: number
): { success: true } | { success: false; errors: ValidationError[] } {
    const result = schema.safeParse(data);

    if (result.success) {
        return { success: true };
    }

    const errors: ValidationError[] = result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
    }));

    console.error(`[next-router] Response validation failed (status ${status}):`, errors);

    return { success: false, errors };
}

export function shouldValidateResponse(
    routeConfig: RouteConfig<any, any, any, any>,
    environment: string = process.env.NODE_ENV || "development"
): boolean {
    if (routeConfig.validateResponse !== undefined) {
        return routeConfig.validateResponse;
    }
    return environment === "development";
}
```

### Updated route Implementation

```typescript
// src/route.ts
import { validateResponse, shouldValidateResponse } from "./utils/response-validation";

export function createRoute<TQuery, TBody, TParams, TResponse, TUser>(
    handler: RouteHandler<TQuery, TBody, TParams, TUser>,
    routeConfig: RouteConfig<TQuery, TBody, TParams, TResponse>,
    controllerConfig: ControllerConfig<TUser>
): NextRouteHandler {
    return async (
        request: NextRequest,
        context?: { params: Promise<Record<string, string>> }
    ): Promise<NextResponse | Response> => {
        try {
            // ... existing authentication & validation logic ...

            // Execute handler
            const response = await handler(handlerContext);

            // Response validation (development only by default)
            if (shouldValidateResponse(routeConfig)) {
                const responseClone = response.clone();
                const status = response.status;

                try {
                    const responseData = await responseClone.json();

                    // Check if we have schema for this status
                    let schema: ZodSchema<any> | undefined;

                    if (routeConfig.responseSchemas && routeConfig.responseSchemas[status]) {
                        schema = routeConfig.responseSchemas[status];
                    } else if (routeConfig.responseSchema) {
                        schema = routeConfig.responseSchema;
                    }

                    if (schema) {
                        const validationResult = validateResponse(schema, responseData, status);

                        if (!validationResult.success) {
                            console.warn(
                                `[next-router] Response validation failed for ${request.method} ${request.url}`,
                                validationResult.errors
                            );
                        }
                    }
                } catch (e) {
                    // Response is not JSON or already consumed, skip validation
                }
            }

            return response;
        } catch (error) {
            console.error("Route handler error:", error);
            return controllerConfig.onInternalError?.(error as Error) ?? createInternalError();
        }
    };
}
```

### OpenAPI Generator

```typescript
// src/openapi/generator.ts
import { ZodSchema } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { RouteConfig, RouteMetadata, OpenAPIConfig } from "../types";

export interface RouteRegistration {
    method: string;
    path: string;
    config: RouteConfig<any, any, any, any>;
}

export class OpenAPIGenerator {
    private routes: RouteRegistration[] = [];
    private config: OpenAPIConfig;

    constructor(config: OpenAPIConfig) {
        this.config = config;
    }

    registerRoute(method: string, path: string, config: RouteConfig<any, any, any, any>) {
        this.routes.push({ method, path, config });
    }

    generate() {
        const paths: Record<string, any> = {};

        for (const route of this.routes) {
            const pathKey = this.convertNextPathToOpenAPI(route.path);

            if (!paths[pathKey]) {
                paths[pathKey] = {};
            }

            paths[pathKey][route.method.toLowerCase()] = this.generateOperation(route);
        }

        return {
            openapi: "3.0.0",
            info: this.config.info,
            servers: this.config.servers || [],
            paths,
            components: {
                securitySchemes: this.config.components?.securitySchemes || {},
                schemas: {},
            },
        };
    }

    private generateOperation(route: RouteRegistration) {
        const { config } = route;
        const operation: any = {
            operationId: config.metadata?.operationId,
            summary: config.metadata?.summary,
            description: config.metadata?.description,
            tags: config.metadata?.tags || [],
            parameters: [],
            responses: {},
        };

        // Query parameters
        if (config.querySchema) {
            const schema = zodToJsonSchema(config.querySchema);
            if (schema.type === "object" && schema.properties) {
                for (const [key, value] of Object.entries(schema.properties)) {
                    operation.parameters.push({
                        name: key,
                        in: "query",
                        schema: value,
                        required: schema.required?.includes(key) || false,
                    });
                }
            }
        }

        // Path parameters
        if (config.paramsSchema) {
            const schema = zodToJsonSchema(config.paramsSchema);
            if (schema.type === "object" && schema.properties) {
                for (const [key, value] of Object.entries(schema.properties)) {
                    operation.parameters.push({
                        name: key,
                        in: "path",
                        schema: value,
                        required: true,
                    });
                }
            }
        }

        // Request body
        if (config.bodySchema) {
            operation.requestBody = {
                required: true,
                content: {
                    "application/json": {
                        schema: zodToJsonSchema(config.bodySchema),
                    },
                },
            };
        }

        // Response schemas
        if (config.responseSchemas) {
            for (const [status, schema] of Object.entries(config.responseSchemas)) {
                operation.responses[status] = {
                    description: this.getDefaultDescription(parseInt(status)),
                    content: {
                        "application/json": {
                            schema: zodToJsonSchema(schema),
                        },
                    },
                };
            }
        } else if (config.responseSchema) {
            operation.responses["200"] = {
                description: "Successful response",
                content: {
                    "application/json": {
                        schema: zodToJsonSchema(config.responseSchema),
                    },
                },
            };
        }

        // Authentication
        if (config.auth === "required") {
            operation.security = config.metadata?.security || [{ bearerAuth: [] }];
        }

        return operation;
    }

    private convertNextPathToOpenAPI(nextPath: string): string {
        // Convert Next.js [id] to OpenAPI {id}
        return nextPath.replace(/\[([^\]]+)\]/g, "{$1}");
    }

    private getDefaultDescription(status: number): string {
        const descriptions: Record<number, string> = {
            200: "Successful response",
            201: "Created",
            400: "Bad request",
            401: "Unauthorized",
            403: "Forbidden",
            404: "Not found",
            409: "Conflict",
            500: "Internal server error",
        };
        return descriptions[status] || "Response";
    }
}
```

### Auto-registration System

```typescript
// src/openapi/registry.ts
export class RouteRegistry {
    private static instance: RouteRegistry;
    private routes: Map<string, RouteRegistration> = new Map();

    static getInstance(): RouteRegistry {
        if (!RouteRegistry.instance) {
            RouteRegistry.instance = new RouteRegistry();
        }
        return RouteRegistry.instance;
    }

    register(method: string, path: string, config: RouteConfig<any, any, any, any>) {
        const key = `${method}:${path}`;
        this.routes.set(key, { method, path, config });
    }

    getRoutes(): RouteRegistration[] {
        return Array.from(this.routes.values());
    }

    clear() {
        this.routes.clear();
    }
}
```

### Updated createController

```typescript
// src/create-controller.ts
import { OpenAPIGenerator } from "./openapi/generator";
import { RouteRegistry } from "./openapi/registry";

export function createController<TUser = any>(config: ControllerConfig<TUser> = {}) {
    const registry = RouteRegistry.getInstance();
    const generator = config.openapi ? new OpenAPIGenerator(config.openapi) : null;

    const route = <TQuery = any, TBody = any, TParams = any, TResponse = any>(
        handler: RouteHandler<TQuery, TBody, TParams, TUser>,
        routeConfig: RouteConfig<TQuery, TBody, TParams, TResponse> = {}
    ): NextRouteHandler => {
        // Auto-register route for OpenAPI (if enabled)
        if (generator && routeConfig.metadata) {
            // Note: Path detection is tricky - might need explicit path param
            // or use call stack analysis
        }

        return createRoute<TQuery, TBody, TParams, TResponse, TUser>(handler, routeConfig, config);
    };

    const generateOpenAPI = () => {
        if (!generator) {
            throw new Error("OpenAPI not configured. Pass openapi config to createController()");
        }

        const routes = registry.getRoutes();
        for (const route of routes) {
            generator.registerRoute(route.method, route.path, route.config);
        }

        return generator.generate();
    };

    return { route, generateOpenAPI };
}
```

---

## 📚 Usage Examples

### Example 1: Simple Response Schema

```typescript
// app/api/users/[id]/route.ts
import { route } from "@/lib/controller";
import { z } from "zod";

const UserSchema = z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    name: z.string(),
    createdAt: z.string().datetime(),
});

export const GET = route(
    async ({ params }) => {
        const user = await db.user.findUnique({ where: { id: params.id } });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        return NextResponse.json({
            id: user.id,
            email: user.email,
            name: user.name,
            createdAt: user.createdAt.toISOString(),
        });
    },
    {
        auth: "required",
        paramsSchema: z.object({ id: z.string().uuid() }),
        responseSchema: UserSchema,
        validateResponse: true, // Validate in dev
        metadata: {
            operationId: "getUser",
            summary: "Get user by ID",
            tags: ["users"],
        },
    }
);
```

### Example 2: Multiple Response Schemas

```typescript
// app/api/users/route.ts
import { route } from "@/lib/controller";
import { z } from "zod";

const CreateUserSchema = z.object({
    email: z.string().email(),
    name: z.string().min(2),
    password: z.string().min(8),
});

const UserResponseSchema = z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    name: z.string(),
});

const ErrorResponseSchema = z.object({
    error: z.string(),
    code: z.string(),
});

export const POST = route(
    async ({ body }) => {
        const existing = await db.user.findUnique({
            where: { email: body.email },
        });

        if (existing) {
            return NextResponse.json(
                { error: "Email already exists", code: "DUPLICATE_EMAIL" },
                { status: 409 }
            );
        }

        const user = await UserService.create(body);

        return NextResponse.json(
            { id: user.id, email: user.email, name: user.name },
            { status: 201 }
        );
    },
    {
        auth: "required",
        bodySchema: CreateUserSchema,
        responseSchemas: {
            201: UserResponseSchema,
            409: ErrorResponseSchema,
        },
        metadata: {
            operationId: "createUser",
            summary: "Create new user",
            tags: ["users"],
        },
    }
);
```

### Example 3: OpenAPI Documentation Endpoint

```typescript
// lib/controller.ts
import { createController } from "next-router";
import { auth } from "@/auth";

export const { route, generateOpenAPI } = createController({
    auth: {
        getSession: async () => {
            const session = await auth();
            return session?.user ?? null;
        },
    },
    openapi: {
        info: {
            title: "My API",
            version: "1.0.0",
            description: "API for my application",
        },
        servers: [
            { url: "https://api.example.com", description: "Production" },
            { url: "http://localhost:3000", description: "Development" },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT",
                },
            },
        },
    },
});

// app/api/openapi.json/route.ts
import { generateOpenAPI } from "@/lib/controller";
import { NextResponse } from "next/server";

export async function GET() {
    const spec = generateOpenAPI();
    return NextResponse.json(spec);
}

// Access at: http://localhost:3000/api/openapi.json
// Use with Swagger UI: https://petstore.swagger.io/?url=http://localhost:3000/api/openapi.json
```

### Example 4: Manual Route Registration

```typescript
// lib/routes.ts - Manual registration for better control
import { registerRoute } from "next-router";

// Register routes manually for OpenAPI generation
export function registerAPIRoutes() {
    registerRoute("GET", "/api/users", {
        metadata: { operationId: "listUsers", tags: ["users"] },
        querySchema: z.object({ page: z.coerce.number() }),
        responseSchema: z.object({ data: z.array(UserSchema) }),
    });

    registerRoute("POST", "/api/users", {
        metadata: { operationId: "createUser", tags: ["users"] },
        bodySchema: CreateUserSchema,
        responseSchemas: { 201: UserResponseSchema },
    });

    registerRoute("GET", "/api/users/[id]", {
        metadata: { operationId: "getUser", tags: ["users"] },
        paramsSchema: z.object({ id: z.string().uuid() }),
        responseSchema: UserResponseSchema,
    });
}

// Call in app initialization or build script
registerAPIRoutes();
```

---

## 🚀 Benefits

### 1. Type Safety

```typescript
// ✅ TypeScript가 response 타입 검증
const response = await fetch("/api/users/123");
const data: User = await response.json(); // 타입이 보장됨
```

### 2. Development Validation

```typescript
// Development 환경에서 잘못된 response를 반환하면 콘솔에 경고
// Warning: Response validation failed
// - field: email, message: Invalid email
```

### 3. OpenAPI Documentation

```yaml
openapi: 3.0.0
paths:
    /api/users/{id}:
        get:
            operationId: getUser
            tags: [users]
            parameters:
                - name: id
                  in: path
                  required: true
                  schema:
                      type: string
                      format: uuid
            responses:
                "200":
                    content:
                        application/json:
                            schema:
                                type: object
                                properties:
                                    id: { type: string }
                                    email: { type: string }
                                    name: { type: string }
```

### 4. API Client Generation

```bash
# OpenAPI spec으로 TypeScript client 자동 생성
npx openapi-typescript-codegen --input http://localhost:3000/api/openapi.json --output ./src/api
```

---

## 📋 Implementation Checklist

### Phase 1: Core Response Schema

-   [ ] Update types (RouteConfig, RouteMetadata)
-   [ ] Implement response validation utility
-   [ ] Update route to validate responses
-   [ ] Add tests for response validation

### Phase 2: OpenAPI Generation

-   [ ] Add zod-to-json-schema dependency
-   [ ] Implement OpenAPIGenerator class
-   [ ] Implement route registry
-   [ ] Update createController with generateOpenAPI

### Phase 3: Documentation & Examples

-   [ ] Update README with response schema examples
-   [ ] Create OpenAPI generation guide
-   [ ] Add example projects
-   [ ] Write migration guide

### Phase 4: Advanced Features

-   [ ] Manual route registration
-   [ ] Custom OpenAPI transformers
-   [ ] Swagger UI integration example
-   [ ] API client generation guide

---

## 🎯 Future Enhancements

1. **GraphQL Support**: Generate GraphQL schema from Zod schemas
2. **Mock Server**: Auto-generate mock server from schemas
3. **API Versioning**: Support for multiple API versions
4. **Rate Limiting Metadata**: Include rate limit info in OpenAPI
5. **WebSocket Support**: Schema validation for WebSocket messages
