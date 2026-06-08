// Fixed en-US format so build-time (server) and any client render agree.
const fmt = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

export function formatDate(iso: string): string {
  return fmt.format(new Date(iso));
}
