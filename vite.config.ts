import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
        server: {
            port: 3009,
            host: '0.0.0.0',
            //allowedHosts: true,
	    allowedHosts: ['med.openaiua.cloud'],
            proxy: {
                '/api/ollama': {
                    target: env.VITE_OLLAMA_BASE_URL || 'http://192.168.50.250:11434',
                    changeOrigin: true,
                    secure: false,
                    rewrite: (path) => path.replace(/^\/api\/ollama/, ''),
                     configure: (proxy, options) => {
                         proxy.on('proxyReq', (proxyReq, req) => {
                             proxyReq.removeHeader('origin')
                             proxyReq.removeHeader('referer')
                             const origin = req.headers.origin;
                             proxy.on('proxyRes', (proxyRes) => {
                                 proxyRes.headers['Access-Control-Allow-Origin'] = origin || '*'
                                 proxyRes.headers['Access-Control-Allow-Headers'] = '*'
                                 proxyRes.headers['Access-Control-Allow-Methods'] = 'GET,POST,OPTIONS'
                             });
                         })
                     },
                },
            },
        },
        plugins: [react()],
        define: {
            'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
            'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
        },
        resolve: {
            alias: {
                '@': path.resolve(path.dirname(fileURLToPath(import.meta.url)), '.'),
            }
        }
    };
});
