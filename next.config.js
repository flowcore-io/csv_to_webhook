/** @type {import('next').NextConfig} */
// const nextConfig = {}

// module.exports = nextConfig

const isProd = process.env.NODE_ENV === 'production';

module.exports = {
    output: 'standalone',
    basePath: isProd ? '/csv_to_webhook' : '',
    assetPrefix: isProd ? '/csv_to_webhook/' : '',
};
