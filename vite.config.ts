import angular from '@analogjs/vite-plugin-angular'
import federation from '@originjs/vite-plugin-federation'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    angular(),
    federation({
      name: 'app',
      // A host is consumable as a remote too: the orchestrator serves this file
      // at assets/remoteEntry.js, which is what the catalogue entry declares.
      filename: 'remoteEntry.js',
      exposes: {
        './App': './src/app/app.component.ts'
      },
      remotes: {
        // One entry per microfrontend this host consumes.
        //
        // The key is the federation-safe name you import from ("exampleremote/Button").
        // The string passed to remoteUrl() is the *slug* of the microfrontend in the
        // orchestrator: change it to yours, and add one entry per extra remote.
        //
        // Never write a URL here. The host does not choose the version it gets: the
        // backend resolves it and remoteUrl() returns that URL, already pinned, verbatim.
        exampleremote: {
          external: `import('@mfe-orchestrator/client').then(m => m.remoteUrl('example-remote'))`,
          externalType: 'promise'
        }
      },
      shared: ['@angular/core', '@angular/common', '@angular/platform-browser', 'rxjs']
    })
  ],
  // Drops Angular's development only assertions, the way the Angular CLI does in
  // a production build. Without it the debug helpers end up in the bundle.
  define: {
    ngDevMode: 'false'
  },
  build: {
    modulePreload: false,
    target: 'esnext',
    minify: false,
    cssCodeSplit: false
  }
})
