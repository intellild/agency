import { appTools, defineConfig } from '@modern-js/app-tools';

// https://modernjs.dev/en/configure/app/usage
export default defineConfig({
  plugins: [appTools()],
  tools: {
    swc: {
      jsc: {
        externalHelpers: false,
        experimental: {
          plugins: [['@swc-jotai/react-refresh', {}]],
        },
      },
    },
  },
});
