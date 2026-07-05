//@ts-check

const { composePlugins, withNx } = require('@nx/next');
const { cspHeader } = require('@lean-dev-br/csp');

/**
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 **/
const nextConfig = {
  // Use this to set Nx-specific options
  // See: https://nx.dev/recipes/next/next-config-setup
  nx: {},
  // Static export — pure HTML into the existing S3 + CloudFront under /blog.
  output: 'export',
  basePath: '/blog',
  trailingSlash: true,
  images: { unoptimized: true },
  // Ship .map files for legible stack traces in devtools + Grafana Faro. Source
  // is already public on GitHub, so exposure is a non-issue for this portfolio.
  productionBrowserSourceMaps: true,
  // Dev-server CSP parity: serve the blog CSP so non-TT policy regressions surface
  // locally. No Trusted Types in dev — Next's HMR/overlay script injectors aren't
  // TT-clean (noise); the blog's TT is enforced in prod only (CloudFront), verified
  // via the prod preview harness (`nx preview blog`). Ignored by `output: export`.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: cspHeader({ mode: 'dev', app: 'blog' }) },
        ],
      },
    ];
  },
};

const plugins = [
  // Add more Next.js plugins to this list if needed.
  withNx,
];

module.exports = composePlugins(...plugins)(nextConfig);
