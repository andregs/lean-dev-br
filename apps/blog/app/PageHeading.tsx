import type { ReactNode } from 'react';

// Shared page heading: serif <h1> + the short accent divider. Used by the blog
// index, tag pages, and the dev editor so the spacing never drifts between them.
export function PageHeading({ children }: { children: ReactNode }) {
  return (
    <div className="page-heading">
      <h1>{children}</h1>
      <hr className="rule" />
    </div>
  );
}
