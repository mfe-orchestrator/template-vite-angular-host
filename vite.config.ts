import angular from '@analogjs/vite-plugin-angular'
import federation from '@originjs/vite-plugin-federation'
import { defineConfig, type Plugin } from 'vite'

const angularPlugins = angular() as Plugin[]

/**
 * Keeps the Angular compiler and Module Federation from stepping on each other.
 *
 * @analogjs/vite-plugin-angular compiles the whole app inside its `buildStart`
 * hook and only hands Vite compiled output afterwards. Rollup runs every
 * plugin's `buildStart` in parallel and starts pulling in the chunks a plugin
 * emits from it right away — which is exactly what vite-plugin-federation does
 * with remoteEntry.js and, through it, with every module listed in `exposes`.
 * The exposed component is therefore transformed while the Angular compilation
 * is still running: the plugin has nothing to return, Vite silently falls back
 * to a plain esbuild transpile, and the component ships with its decorators
 * uncompiled. The build still succeeds; the browser dies at bootstrap with
 * "JIT compiler unavailable".
 *
 * Holding every transform until that first compilation has settled removes the
 * race. Once it has, awaiting a settled promise costs nothing. Drop this only
 * if you also drop `exposes` below.
 */
const waitForAngularCompilation = (): Plugin => {
  const compiler = angularPlugins.find(plugin => typeof plugin.buildStart === 'function')
  let compilation: Promise<void> = Promise.resolve()

  if (compiler && typeof compiler.buildStart === 'function') {
    const compile = compiler.buildStart
    compiler.buildStart = function (options) {
      compilation = Promise.resolve(compile.call(this, options))
      return compilation
    }
  }

  return {
    name: 'wait-for-angular-compilation',
    enforce: 'pre',
    async transform() {
      await compilation
      return null
    }
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    waitForAngularCompilation(),
    angularPlugins,
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
          external: `import('@mfe-orchestrator-hub/client').then(m => m.remoteUrl('example-remote'))`,
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
