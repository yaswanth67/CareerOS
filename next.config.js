/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  // The career-ops evaluate pipeline reads its workspace files live
  // (modes/_shared.md, modes/oferta.md, cv.md) via a runtime-computed path
  // (CAREER_OPS_DIR or ./career-ops). Tell the file tracer exactly what to ship
  // so it doesn't fall back to tracing the whole project.
  outputFileTracingIncludes: {
    '/api/career-ops/**': ['./career-ops/**/*'],
    '/api/jobs/[id]/career-ops': ['./career-ops/**/*'],
  },
}

module.exports = nextConfig