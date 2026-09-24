
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), 'VITE_');
    return {
    plugins: [react(), {
        name: 'approval-share-preview',
        transformIndexHtml() {
            const business = env.VITE_BUSINESS_NAME || 'Your workshop';
            const tags = [
                { property: 'og:type', content: 'website' },
                { property: 'og:site_name', content: business },
                { property: 'og:title', content: business + ' - Approve your service request' },
                { property: 'og:description', content: 'Review your services, confirm your decision and track your job with the workshop.' },
            ];
            if (/^https:\/\//.test(env.VITE_APPROVAL_PREVIEW_IMAGE || '')) tags.push({ property: 'og:image', content: env.VITE_APPROVAL_PREVIEW_IMAGE });
            return tags.map(attrs => ({ tag: 'meta', attrs, injectTo: 'head' }));
        },
    }],
    server: {
        port: 5173,
        proxy: {
            '/api': {
                target: 'http://localhost:5000',
                changeOrigin: true,
            },
        },
    },
    };
});
