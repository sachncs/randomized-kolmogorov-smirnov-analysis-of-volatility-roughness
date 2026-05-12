# Contributing to RK-SAVR

Thank you for your interest in contributing to RK-SAVR!

## Development Workflow

1. **Open an issue first** — Before starting work on a new feature or bug fix, open an issue to discuss the change.
2. **Branch naming** — Use `feature-<description>` or `fix-<description>` for your branches.
3. **Target `master`** — All pull requests must target the `master` branch.
4. **Do not work on `master` directly**.
5. **Do not bump versions or edit the Changelog** — maintainers will handle this.

## Commit Convention

Use the following format, inspired by Angular commit conventions:

```
<type>(<scope>): <short summary> #<issue number>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

## Requirements

- All public APIs must be documented with JSDoc.
- All features and bug fixes must include unit tests.
- All tests and lint checks must pass before merging.
- Follow the Google JavaScript Style Guide.

## Getting Started

```bash
git clone https://github.com/your-repo/rksavr.git
cd rksavr
npm install
npm test
npm run lint
```

## Running Tests

```bash
npm test                # Run all tests
npm run test:watch      # Watch mode
npm run test:coverage   # Coverage report
```

## Building

```bash
npm run build           # Build all bundles
npm run docs            # Generate API documentation
```
