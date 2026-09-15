import path from 'node:path'
import type { NextConfig } from 'next'

/**
 * The dashboard never addresses a microservice directly - everything goes through the Spring
 * Cloud gateway. In development this rewrite plays the role the Vite proxy used to, so the
 * browser still sees a same-origin /api and no CORS preflight is needed.
 */
const GATEWAY = process.env.GATEWAY_URL ?? 'http://localhost:8080'

const nextConfig: NextConfig = {
  // The parent Downloads folder holds an unrelated package-lock.json; without this Turbopack
  // walks up and picks the wrong workspace root.
  turbopack: { root: path.resolve(__dirname) },

  async rewrites() {
    return [{ source: '/api/:path*', destination: `${GATEWAY}/api/:path*` }]
  },
}

export default nextConfig
