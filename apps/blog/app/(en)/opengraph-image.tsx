import { ImageResponse } from 'next/og';

// Branded social-share image, generated to a static PNG at build (works with
// output: export). Next auto-adds the og:image / twitter:image meta tags.
export const dynamic = 'force-static';
export const alt = 'lean.dev.br — a dev blog';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#0c0e11',
          color: '#e8eaec',
          padding: '90px',
          fontFamily: 'monospace',
        }}
      >
        <div style={{ display: 'flex', fontSize: 40, letterSpacing: '0.05em' }}>
          lean<span style={{ color: '#3ddc84' }}>::</span>dev
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ fontSize: 92, fontWeight: 600, lineHeight: 1.05 }}>The blog</div>
          <div style={{ width: 80, height: 6, background: '#3ddc84', borderRadius: 3 }} />
          <div style={{ fontSize: 34, color: '#8a9099' }}>
            Notes on full-stack & cloud — lean.dev.br/blog
          </div>
        </div>
      </div>
    ),
    size,
  );
}
