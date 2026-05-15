/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Permitimos servir SVGs locales (logo de la escuela) por next/image.
    dangerouslyAllowSVG: true,
    // Política CSP estricta para SVG: bloquea scripts embebidos.
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
}

export default nextConfig
