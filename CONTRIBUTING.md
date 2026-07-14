# Contributing to RK-SAVR

Thank you for your interest in contributing to RK-SAVR! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Branch Naming](#branch-naming)
- [Commit Conventions](#commit-conventions)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Running Tests](#running-tests)
- [Documentation](#documentation)
- [Community](#community)

## Code of Conduct

This project adheres to the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- npm or yarn
- Git

### Setup

1. **Fork the repository** on GitHub.

2. **Clone your fork** locally:

   ```bash
   git clone https://github.com/<your-username>/randomized-kolmogorov-smirnov-analysis-of-volatility-roughness.git
   cd randomized-kolmogorov-smirnov-analysis-of-volatility-roughness
   ```

3. **Install dependencies**:

   ```bash
   npm install
   ```

4. **Verify the setup**:

   ```bash
   npm test
   npm run lint
   ```

## Development Workflow

1. **Open an issue first** — Before starting work on a new feature or bug fix, open an issue to discuss the change. This helps avoid duplicate work and ensures your contribution aligns with the project's direction.

2. **Create a feature branch** from `master`:

   ```bash
   git checkout -b feature/your-feature-name master
   ```

3. **Make your changes** — Write code, add tests, update documentation as needed.

4. **Run tests and lint**:

   ```bash
   npm test
   npm run lint
   ```

5. **Commit your changes** using [Conventional Commits](https://www.conventionalcommits.org/).

6. **Push to your fork** and submit a pull request.

## Branch Naming

Use descriptive branch names with the following prefixes:

| Prefix | Purpose | Example |
|--------|---------|---------|
| `feature/` | New features | `feature/block-permutation` |
| `fix/` | Bug fixes | `fix/asymptotic-variance-formula` |
| `docs/` | Documentation only | `docs/api-reference` |
| `refactor/` | Code refactoring | `refactor/optimizer-registry` |
| `test/` | Adding or updating tests | `test/ks-distance-edge-cases` |
| `chore/` | Maintenance tasks | `chore/update-dependencies` |

## Commit Conventions

We follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/). Use this format:

```
<type>(<scope>): <short summary>

[optional body]

[optional footer(s)]
```

### Types

| Type | Description |
|------|-------------|
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation only changes |
| `style` | Code style changes (formatting, missing semicolons, etc.) |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `test` | Adding or updating tests |
| `chore` | Build process or auxiliary tool changes |

### Examples

```
feat(stats): add block random permutation method
fix(inference): correct asymptotic variance formula per Prop 2.9
docs(readme): add multi-scale analysis usage example
test(rksavr): add edge case tests for empty windows
chore: update eslint to v10
```

### Scope

The scope should be the module or component affected:

- `rksavr` - Main estimator class
- `stats` - Statistics utilities
- `optimization` - Optimizer implementations
- `inference` - Statistical inference
- `models` - Rough volatility models
- `data` - Data loading/preprocessing
- `demo` - Interactive demo
- `ci` - CI/CD configuration

## Pull Request Process

### Before Submitting

- [ ] Code follows the project's coding standards
- [ ] All existing tests pass
- [ ] New tests are added for new functionality
- [ ] Documentation is updated if needed
- [ ] Commit messages follow Conventional Commits format
- [ ] Branch is up-to-date with `master`

### PR Template

When creating a PR, include:

```markdown
## Summary

Brief description of the changes.

## Related Issue

Fixes #123

## Changes

- Change 1
- Change 2

## Testing

Describe how you tested these changes.

## Checklist

- [ ] Tests pass (`npm test`)
- [ ] Lint passes (`npm run lint`)
- [ ] Documentation updated
- [ ] Changelog entry added (if applicable)
```

### Review Process

1. A maintainer will review your PR within 7 days.
2. Changes may be requested — please address feedback promptly.
3. Once approved, a maintainer will merge the PR.

## Coding Standards

### JavaScript Style

- Follow the [Google JavaScript Style Guide](https://google.github.io/styleguide/jsguide.html)
- Use ES2022+ features where appropriate
- All public APIs must have JSDoc documentation
- Use `const` by default, `let` when reassignment is needed
- Avoid `var`

### Linting

We use ESLint with the Google style configuration:

```bash
npm run lint          # Check for issues
npm run lint:fix      # Auto-fix issues
```

### Formatting

We use Prettier for consistent formatting. Configuration is in `.prettierrc`.

### Testing

- Write tests using [Mocha](https://mochajs.org/) and [Chai](https://www.chaijs.com/)
- Place tests in the `tests/` directory
- Name test files `*.tests.js`
- Aim for high test coverage on new code

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

## Documentation

### JSDoc

All public functions and classes must have JSDoc comments:

```javascript
/**
 * Estimates the Hurst parameter for a given window of data.
 *
 * @param {number[]} data - Array of log-volatility values.
 * @returns {number} Estimated Hurst parameter.
 */
function estimate(data) {
  // ...
}
```

### API Documentation

Generate API documentation:

```bash
npm run docs
```

This generates:
- `docs/` - JSDoc HTML documentation
- `API.md` - Markdown API reference

### README Updates

When adding new features, update the README with:
- Feature description
- Usage examples
- Configuration options (if any)

## Community

- **Issues**: [GitHub Issues](https://github.com/sachncs/randomized-kolmogorov-smirnov-analysis-of-volatility-roughness/issues)
- **Discussions**: [GitHub Discussions](https://github.com/sachncs/randomized-kolmogorov-smirnov-analysis-of-volatility-roughness/discussions)

## License

By contributing to RK-SAVR, you agree that your contributions will be licensed under the [MIT License](LICENSE).
