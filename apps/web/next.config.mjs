/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      // CloudFront media bucket
      { protocol: 'https', hostname: '*.cloudfront.net' },
      // Allow direct S3 for development
      { protocol: 'https', hostname: '*.s3.us-east-1.amazonaws.com' },
    ],
  },
};

export default nextConfig;
