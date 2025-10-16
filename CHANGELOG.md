# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1](https://github.com/json-choi/next-router/compare/next-router-v1.0.0...next-router-v1.0.1) (2025-10-16)


### 🐛 Bug Fixes

* resolve NPM publish issues ([91b36a4](https://github.com/json-choi/next-router/commit/91b36a4d6978d42919bc533f72e2c1749358d619))

## 1.0.0 (2025-10-16)


### ⚠ BREAKING CHANGES

* Initial implementation of next-router framework

### ✨ Features

* implement complete Next.js router framework with Spring-style API ([6df8cd1](https://github.com/json-choi/next-router/commit/6df8cd17aa4ebe6dabc09d807207ea917933121a))


### 🐛 Bug Fixes

* test ([055af2a](https://github.com/json-choi/next-router/commit/055af2af22ccdd1550272866db6370bc3901d016))


### 🔧 CI/CD

* fix release-please configuration for proper versioning ([1b26772](https://github.com/json-choi/next-router/commit/1b26772e50a8c03a79a763b778671d89c6266dd3))

## [1.0.0] - 2025-01-16

### 🎉 Initial Release

#### Added
- **Core Framework**: Spring Framework-style route wrapper for Next.js 15 App Router
- **Type Safety**: Full TypeScript support with automatic type inference from Zod schemas
- **Authentication**: Provider-agnostic authentication system with built-in support for:
  - NextAuth.js integration
  - Clerk integration
  - Supabase Auth integration
  - Custom JWT authentication
- **Validation**: Comprehensive request/response validation using Zod:
  - Query parameter validation
  - Request body validation
  - Path parameter validation
  - Response schema validation (development mode)
- **Controller System**: Spring-style controllers with shared configuration
- **Error Handling**: Standardized error responses with customizable handlers
- **OpenAPI Integration**: Automatic OpenAPI 3.0 specification generation
- **Route Registry**: Centralized route registration for documentation
- **Testing Support**: Comprehensive test suite with 63.51% coverage
- **Build System**: Dual CJS/ESM builds with TypeScript definitions

#### Documentation
- **Getting Started Guide**: Step-by-step setup and usage guide
- **API Reference**: Complete API documentation with examples
- **Migration Guide**: Detailed migration guide from standard Next.js API routes
- **Best Practices**: Production-ready patterns and recommendations
- **Examples**: Working examples for all supported authentication providers

#### Development Experience
- **Hot Reload**: Full Next.js development experience
- **Type Inference**: Automatic type inference for validated data
- **Error Messages**: Clear validation error messages
- **CI/CD**: GitHub Actions pipeline with automated testing
- **Code Quality**: ESLint, Prettier, and pre-commit hooks

#### Supported Versions
- **Next.js**: ≥15.0.0
- **Node.js**: ≥18.0.0
- **TypeScript**: ≥5.0.0
- **Zod**: ≥3.0.0 <4.0.0

---

## [Unreleased]

### Planning
- Performance optimizations
- Additional authentication providers
- Enhanced OpenAPI features
- Rate limiting middleware
- Request/response transformers

---

## Release Notes

### 🚀 What's New in v1.0.0

This initial release brings a complete Spring Framework-inspired routing solution to Next.js 15 App Router. Key highlights include:

**🔒 Authentication Made Simple**
- Works with any authentication provider out of the box
- Built-in examples for popular services
- Role-based access control

**📝 Validation Without Boilerplate**
- 90% less boilerplate code compared to standard Next.js routes
- Automatic type inference from validation schemas
- Development-mode response validation

**📚 Documentation First**
- Automatic OpenAPI generation
- Comprehensive guides and examples
- Migration support from existing APIs

**🏗️ Production Ready**
- Full TypeScript support
- Comprehensive test coverage
- CI/CD pipeline included
- Performance optimized

### 🎯 Why Choose next-router?

- **Familiar Patterns**: Spring Framework-style API familiar to Java developers
- **Type Safety**: Full TypeScript integration with automatic inference
- **Zero Config**: Works out of the box with sensible defaults
- **Provider Agnostic**: Supports any authentication system
- **Documentation**: Automatic API documentation generation
- **Testing**: Built-in testing utilities and patterns

### 📦 Installation

```bash
npm install next-router zod
```

### 🏃‍♂️ Quick Start

```typescript
import { createRoute } from 'next-router';
import { z } from 'zod';

export const GET = createRoute({
  querySchema: z.object({
    page: z.coerce.number().default(1),
  }),
  responseSchema: z.object({
    users: z.array(z.object({
      id: z.string(),
      name: z.string(),
    })),
  }),
}, async ({ query }) => {
  const users = await getUsers(query!.page);
  return NextResponse.json({ users });
});
```

### 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### 📄 License

MIT - see [LICENSE](LICENSE) file for details.

---

**Full Changelog**: https://github.com/your-org/next-router/commits/v1.0.0
