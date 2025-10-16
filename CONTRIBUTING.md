# Contributing to next-router

Thank you for your interest in contributing to next-router! We welcome contributions from the community and appreciate your help in making this project better.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Contributing Guidelines](#contributing-guidelines)
- [Pull Request Process](#pull-request-process)
- [Reporting Issues](#reporting-issues)
- [Community](#community)

## Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code. Please report unacceptable behavior to [project maintainers].

## Getting Started

### Types of Contributions

We welcome many types of contributions:

- 🐛 **Bug reports and fixes**
- ✨ **New features and enhancements**
- 📖 **Documentation improvements**
- 🧪 **Test coverage improvements**
- 🎨 **Code quality improvements**
- 🌍 **Translation and localization**
- 💡 **Ideas and feature requests**

### Before You Start

1. **Search existing issues** - Check if your bug/feature is already reported
2. **Start with small changes** - Large changes require prior discussion
3. **Read the docs** - Familiarize yourself with the project
4. **Follow conventions** - Maintain consistency with existing code

## Development Setup

### Prerequisites

- Node.js ≥18.0.0
- pnpm (recommended) or npm
- Git

### Local Setup

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/your-username/next-router.git
   cd next-router
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Run tests to verify setup**
   ```bash
   pnpm test
   ```

4. **Start development**
   ```bash
   pnpm dev
   ```

### Project Structure

```
next-router/
├── src/                    # Main source code
│   ├── core/              # Core functionality
│   ├── utils/             # Utility functions
│   └── openapi/           # OpenAPI integration
├── tests/                 # Test files
├── examples/              # Usage examples
├── docs/                  # Documentation
└── scripts/               # Build and utility scripts
```

### Available Scripts

```bash
# Development
pnpm dev                   # Watch mode development
pnpm build                 # Build the package
pnpm clean                 # Clean build artifacts

# Testing
pnpm test                  # Run tests
pnpm test:coverage         # Run tests with coverage
pnpm test:watch           # Run tests in watch mode

# Code Quality
pnpm lint                  # Check linting
pnpm lint:fix             # Fix linting issues
pnpm format               # Format code
pnpm type-check           # Check TypeScript types

# Release
pnpm prepublishOnly       # Full pre-publish check
```

## Contributing Guidelines

### Code Style

We use automated tools to maintain code quality:

- **ESLint** - For code linting
- **Prettier** - For code formatting
- **TypeScript** - For type checking
- **Husky** - For pre-commit hooks

Run `pnpm lint:fix` and `pnpm format` before committing.

### Commit Messages

We follow the [Conventional Commits](https://conventionalcommits.org/) specification:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

#### Types

- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `style` - Code style changes (formatting, etc.)
- `refactor` - Code refactoring
- `test` - Test additions or modifications
- `chore` - Maintenance tasks

#### Examples

```bash
feat: add support for custom validation messages
fix: resolve authentication provider type inference
docs: update getting started guide with new examples
test: add integration tests for OpenAPI generation
```

### Testing

- **Write tests** for new features and bug fixes
- **Maintain coverage** - Aim for >90% test coverage
- **Include integration tests** for complex features
- **Test across Node.js versions** - We support 18.x and 20.x

#### Test Types

```bash
# Unit tests
pnpm test src/core

# Integration tests
pnpm test tests/integration

# Coverage report
pnpm test:coverage
```

### Documentation

- **Update docs** for any user-facing changes
- **Add examples** for new features
- **Keep README current** - Update if behavior changes
- **API documentation** - Document all public APIs

## Pull Request Process

### Before Submitting

1. **Run the full test suite**
   ```bash
   pnpm test
   ```

2. **Check linting and formatting**
   ```bash
   pnpm lint
   pnpm format:check
   ```

3. **Verify TypeScript compilation**
   ```bash
   pnpm type-check
   ```

4. **Test the build**
   ```bash
   pnpm build
   ```

### PR Checklist

- [ ] Tests pass locally
- [ ] Code is properly formatted and linted
- [ ] Documentation is updated (if needed)
- [ ] Commit messages follow conventional format
- [ ] PR description explains what/why
- [ ] Examples are added/updated (if applicable)
- [ ] Breaking changes are documented

### PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix (non-breaking change)
- [ ] New feature (non-breaking change)
- [ ] Breaking change (fix or feature causing existing functionality to break)
- [ ] Documentation update

## Testing
- [ ] New tests added
- [ ] Existing tests pass
- [ ] Manual testing performed

## Checklist
- [ ] Code follows project conventions
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No console logs or debug code
```

### Review Process

1. **Automated checks** - CI/CD pipeline runs automatically
2. **Code review** - Maintainers review your changes
3. **Feedback** - Address any requested changes
4. **Approval** - Changes are approved by maintainers
5. **Merge** - PR is merged into main branch

## Reporting Issues

### Bug Reports

When reporting bugs, please include:

- **Environment details** (Node.js version, Next.js version, etc.)
- **Steps to reproduce** the issue
- **Expected behavior**
- **Actual behavior**
- **Minimal reproduction example** (if possible)

### Feature Requests

For feature requests, please provide:

- **Use case** - Why is this needed?
- **Proposed solution** - How should it work?
- **Alternatives considered** - What other options exist?
- **Additional context** - Screenshots, mockups, etc.

### Security Issues

For security vulnerabilities, please email [security@example.com] instead of opening a public issue.

## Development Guidelines

### Adding New Features

1. **Discuss first** - Open an issue for significant changes
2. **Start small** - Begin with a minimal implementation
3. **Follow patterns** - Match existing code style and architecture
4. **Add tests** - Ensure comprehensive test coverage
5. **Document** - Update relevant documentation
6. **Examples** - Provide usage examples

### Code Organization

- **Single responsibility** - Each module should have a clear purpose
- **Type safety** - Use TypeScript strictly
- **Error handling** - Provide clear error messages
- **Performance** - Consider performance implications
- **Backwards compatibility** - Avoid breaking changes when possible

### Dependencies

- **Minimize dependencies** - Only add truly necessary packages
- **Peer dependencies** - Use peer dependencies for user-provided packages
- **Security** - Regular dependency updates and security audits
- **Licensing** - Ensure compatible licenses

## Community

### Getting Help

- **GitHub Discussions** - For questions and community discussion
- **Issues** - For bug reports and feature requests
- **Discord** - Real-time community chat (if available)
- **Stack Overflow** - Tag questions with `next-router`

### Recognition

Contributors are recognized in several ways:

- **Contributors list** - Added to README.md
- **Changelog** - Credited in release notes
- **All Contributors** - Recognition system (if implemented)

### Maintainer Notes

For maintainers only:

#### Release Process

1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. Create release PR
4. Merge to main
5. Create GitHub release
6. Publish to npm

Thank you for contributing to next-router! 🚀

---

*This contributing guide is adapted from open source best practices and will evolve as our community grows.*
