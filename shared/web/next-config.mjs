/**
 * One Next.js configuration for all three clients, so the security headers and dev settings exist in a single place.
 * Each client's next.config.mjs calls createNextConfig().
 *
 * In development the browser talks to the client on its own port and Next forwards /api to the one backend (API_ORIGIN).
 * In production Cloudflare routes <client domain>/api/* straight to the backend Worker, so the rewrite is never used.
 */
export function createNextConfig() {
  const prod = process.env.NODE_ENV === 'production';
  const API_ORIGIN = process.env.API_ORIGIN ?? (prod ? '' : 'http://localhost:8787');
  const upload = process.env.NEXT_PUBLIC_UPLOAD_ORIGIN ? ` ${process.env.NEXT_PUBLIC_UPLOAD_ORIGIN.replace(/\/?$/, '/')}` : '';
  return {
    reactStrictMode: true,
    poweredByHeader: false,
    // The round "N" badge in development shows only when NEXT_PUBLIC_DEV_TOOLS=true.
    devIndicators: !prod && process.env.NEXT_PUBLIC_DEV_TOOLS === 'true' ? { position: 'bottom-right' } : false,
    transpilePackages: ['@dastaan/shared'],
    // Lets people open the dev server through a VS Code forwarded port (Dev Tunnel) or a *.localhost name.
    allowedDevOrigins: ['*.devtunnels.ms', '*.localhost'],
    async rewrites() {
      return API_ORIGIN ? [{ source: '/api/:path*', destination: `${API_ORIGIN}/api/:path*` }] : [];
    },
    async headers() {
      return [
        {
          source: '/:path*',
          headers: [
            { key: 'X-Content-Type-Options', value: 'nosniff' },
            { key: 'X-Frame-Options', value: 'DENY' },
            { key: 'Referrer-Policy', value: 'same-origin' },
            { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
            {
              key: 'Content-Security-Policy',
              value: [
                "default-src 'self'",
                "script-src 'self' 'unsafe-inline'" + (prod ? '' : " 'unsafe-eval'"),
                "style-src 'self' 'unsafe-inline'",
                "img-src 'self' data: blob:",
                "font-src 'self' data:",
                `connect-src 'self'${upload}`,
                "worker-src 'self' blob:",
                "frame-ancestors 'none'",
                "base-uri 'self'",
                "form-action 'self'",
              ].join('; '),
            },
          ],
        },
      ];
    },
  };
}
