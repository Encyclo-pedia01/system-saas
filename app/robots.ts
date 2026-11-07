import type { MetadataRoute } from 'next';

// The platform is private. Search engines are asked to stay out entirely.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      disallow: '/',
    },
  };
}
