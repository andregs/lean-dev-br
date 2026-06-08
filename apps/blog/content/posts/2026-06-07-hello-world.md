---
title: Hello, world
date: 2026-06-07T09:00:00Z
description: First post — why this blog exists and how it's built.
tags: [meta, nextjs]
---

This is the first post on the **lean.dev.br** dev blog. It's a static
[Next.js](https://nextjs.org) app — markdown in, HTML out at build time, served
from the same S3 + CloudFront that hosts the homepage. Zero new runtime cost.

## Code blocks

Syntax highlighting is build-time, class-based (no inline styles, CSP stays strict):

```ts
export function greet(name: string): string {
  return `Hello, ${name}!`;
}
```

More posts to come.
