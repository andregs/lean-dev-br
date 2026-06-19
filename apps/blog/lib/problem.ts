// RFC 7807 (application/problem+json) response helper.
// Per CLAUDE.local.md: all HTTP error responses must use this content type.
// The surface is tiny; no ecosystem lib added to avoid an extra dep.

export interface ProblemDetail {
  type?: string;
  title: string;
  status: number;
  detail?: string;
}

export function problem(detail: ProblemDetail): Response {
  return new Response(JSON.stringify(detail), {
    status: detail.status,
    headers: { 'Content-Type': 'application/problem+json' },
  });
}
