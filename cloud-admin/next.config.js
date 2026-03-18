/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  async headers() {
    const corsHeaders = [
      { key: 'Access-Control-Allow-Origin', value: '*' },
      { key: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
      { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
    ];
    return [
      { source: '/api/playlist', headers: corsHeaders },
      { source: '/api/playlists', headers: corsHeaders },
      { source: '/api/image', headers: corsHeaders },
    ];
  },
  webpack: (config) => {
    // pdfjs-dist worker をバンドル対象から除外
    config.resolve.alias.canvas = false;
    config.module.rules.push({
      test: /pdf\.worker\.(min\.)?mjs$/,
      type: 'asset/resource',
      generator: {
        filename: 'static/worker/[hash][ext][query]',
      },
    });
    return config;
  },
};
module.exports = nextConfig;
