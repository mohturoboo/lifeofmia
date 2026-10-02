import type { NextConfig } from 'next';

/**
 * Configuration Next.js de LifeofM.
 * Les en-tetes de securite sont appliques globalement (defense en profondeur,
 * en complement du middleware qui gere CSRF / auth).
 */
const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=(self)' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // Next.js injecte des scripts inline hashes en production ; 'unsafe-inline'
      // reste necessaire pour le runtime de dev.
      process.env.NODE_ENV === 'production'
        ? "script-src 'self' 'unsafe-inline'"
        : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://api.openweathermap.org https://api.aladhan.com https://nominatim.openstreetmap.org",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  /*
   * Metadonnees bloquantes pour tous les clients. Le layout racine lit la
   * session (cookies) : la page est dynamique, et Next 15 diffusait alors
   * `<title>` et la description APRES `</head>`, dans le `<body>`, pour les
   * navigateurs. Lighthouse et une partie des robots ne les y trouvaient pas.
   */
  htmlLimitedBots: /.*/,
  experimental: {
    optimizePackageImports: ['framer-motion'],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
