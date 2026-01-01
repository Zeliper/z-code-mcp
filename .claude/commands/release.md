---
allowed-tools: Bash(npm run build:*), Bash(npm version:*), Bash(git:*), Bash(gh:*)
argument-hint: [patch|minor|major]
description: Build, version bump, and trigger npm publish
---

# Release to npm

Create a new release version and trigger GitHub Actions for npm publish.

## Steps

1. Run `npm run build` to compile TypeScript
2. Run `npm version $ARGUMENTS` to bump version (default: patch)
3. Push the new tag: `git push && git push --tags`
4. GitHub Actions will automatically publish to npm

## Version Options

- `patch`: Bug fixes (1.0.0 -> 1.0.1)
- `minor`: New features (1.0.0 -> 1.1.0)
- `major`: Breaking changes (1.0.0 -> 2.0.0)

## Post-release

After push, check GitHub Actions at:
https://github.com/Zeliper/z-code-mcp/actions
