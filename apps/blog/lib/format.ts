// Fixed en-US + UTC format so build-time (server) and client renders agree, plus
// it gives the blog a nerdy treat, and so multiple posts on the same day stay
// distinguishable — frontmatter dates are full datetimes, used for ordering.
const fmt = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'UTC',
});

export function formatDate(iso: string): string {
  return `${fmt.format(new Date(iso))} UTC`;
}
