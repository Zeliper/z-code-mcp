---
allowed-tools: Bash(npm run build:*), Bash(git add:*), Bash(git commit:*), Bash(git status:*), Bash(git diff:*), Bash(npm version:*)
argument-hint: [commit-message]
description: Build the project and create a git commit
---

# Build and Commit

Build the TypeScript project and optionally commit changes.

## Steps

1. Run `npm run build` to compile TypeScript
2. Check `git status` for changes
3. If changes exist, stage and commit with the provided message

## Commit Message

Use the provided argument as commit message: "$ARGUMENTS"

If no message provided, use: "build: update build artifacts"

## After Build

- Stage all changes including build output
- Create commit with the message
- Show final git status
