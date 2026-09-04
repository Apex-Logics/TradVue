const { buildContentSecurityPolicy, DEFAULT_API_URL } = require('./lib/contentSecurityPolicy')

const publicApiUrl = process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: __dirname,
  },
  env: {
    NEXT_PUBLIC_API_URL: publicApiUrl,
  },
  // CSP is built at compile time from NEXT_PUBLIC_API_URL so Preview/staging
  // builds allow the staging API without adding that host to the prod policy.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: buildContentSecurityPolicy({ apiUrl: publicApiUrl }),
          },
        ],
      },
    ]
  },
  async redirects() {
    return [
      {
        source: '/analysis',
        destination: '/?view=analysis',
        permanent: true,
      },
      {
        source: '/prop-firm',
        destination: '/prop-firm-tracker',
        permanent: true,
      },
    ]
  },
}

module.exports = nextConfig