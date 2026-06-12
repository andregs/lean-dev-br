# CLAUDE.md - Project Context

## Project Overview
**lean.dev.br** is a monorepo containing a personal portfolio and demo projects that showcase full-stack development across multiple technologies and cloud platforms.

**Domain:** lean.dev.br

**Repository:** GitHub monorepo

---

## CSS Conventions

- **Never target bare HTML elements** in CSS selectors (e.g. `.list-field label`, `.setup-screen p`). The markup is ours, so always add a class to the element and select that class instead. This keeps specificity predictable and styles resilient to markup changes.

---

## Git Conventions

- Use **Conventional Commits**: `type(scope): description` — e.g. `feat(homepage): add contact form`
- Common types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`

---

## References

- [Nx Documentation](https://nx.dev/docs/reference)
- [AWS Pricing](https://aws.amazon.com/pricing/)
- [reCAPTCHA](https://developers.google.com/recaptcha/docs)


<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

## General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax


<!-- nx configuration end-->