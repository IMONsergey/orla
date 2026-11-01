import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
const site = process.env.SITE_URL || process.env.PUBLIC_SITE_URL || 'https://orla-imon.vercel.app';
export default defineConfig({ site, output: 'static', adapter: vercel(), trailingSlash: 'always', devToolbar: { enabled: false } });
