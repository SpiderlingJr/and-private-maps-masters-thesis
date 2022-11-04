/** @type {import('vite').UserConfig} */ export default {
  server: {
    proxy: {
      "^/collections/.*": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
};
