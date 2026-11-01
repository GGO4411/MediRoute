/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // Transformers.js loads ONNX Runtime's native Node bindings server-side.
  serverExternalPackages: ['@xenova/transformers', 'onnxruntime-node']
};
export default nextConfig;
