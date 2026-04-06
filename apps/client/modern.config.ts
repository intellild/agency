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
    rspack: config => {
      // Add Icons plugin
      config.plugins = config.plugins || [];
      config.plugins.push(Icons({ compiler: 'jsx', jsx: 'react' }));

      // // Configure experiments for libp2p WebAssembly support
      // config.experiments = {
      //   ...config.experiments,
      //   asyncWebAssembly: true,
      // };
      //
      // // Handle WebAssembly files
      // config.module = config.module || {};
      // config.module.rules = config.module.rules || [];
      // config.module.rules.push({
      //   test: /\.wasm$/,
      //   type: 'webassembly/async',
      // });

      return config;
    },
  },
});
