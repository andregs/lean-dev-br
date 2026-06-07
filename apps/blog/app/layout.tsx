import './global.scss';

export const metadata = {
  title: 'Welcome to blog',
  description: 'A demo Next.js blog for lean.dev.br',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
