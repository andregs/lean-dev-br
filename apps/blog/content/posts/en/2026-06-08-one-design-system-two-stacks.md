---
title: One design system, two stacks
date: 2026-06-08T15:30:00Z
description: Sharing tokens and structural CSS between a vanilla-JS site and a Next.js app.
tags: [css, monorepo, nextjs]
---

The homepage is plain HTML/CSS/JS built with Vite. This blog is a Next.js static
export. Two different stacks, but they should look like **one site**.

## Share the CSS, not just the tokens

Sharing colour and type tokens alone wasn't enough; the nav, footer, and layout
rules drifted. So the structural styles live in a workspace package that both apps
import, and both render the same markup classes:

```css
/* @lean-dev-br/styles/nav.css — scoped to a class, never the bare element */
.site-nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  backdrop-filter: blur(14px);
}
```

Scoping to `.site-nav` instead of a bare `nav {}` selector keeps the rule from
leaking onto other navigation landmarks — like a post's previous/next footer.

## One source of truth

Tokens, base layout, nav, and footer are authored once and consumed by both the
Vite build and the Next build. Change a hairline colour in one place and the whole
site moves together.
