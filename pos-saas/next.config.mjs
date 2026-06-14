import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async redirects() {
    return [{ source: '/', destination: '/pos', permanent: false }]
  },
}

export default nextConfig
