import { appTools, defineConfig } from '@modern-js/app-tools';
import Icons from 'unplugin-icons/rspack';

// https://modernjs.dev/en/configure/app/usage
export default defineConfig({
  plugins: [appTools()],
  tools: {
    swc: {
      jsc: {
        externalHelpers: false,
        experimental: {
          plugins: [
            ['@swc-jotai/react-refresh', {}],
            ['@swc-jotai/debug-label', {}],
          ],
        },
      },
    },
    rspack: {
      plugins: [Icons({ compiler: 'jsx', jsx: 'react' })],
    },
  },
});
