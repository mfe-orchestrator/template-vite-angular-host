# Vite & Angular — host template

Starter template for the [MFE Orchestrator](https://github.com/mfe-orchestrator), listed in the
marketplace as `vite-host-angular`. Vite + Angular 22, wired as a **host**.

## Requirements

- Node.js 22.22.3, 24.15 or newer (what Angular 22 supports)
- [pnpm](https://pnpm.io) 12 (pinned in `packageManager`; `corepack enable` picks it up)

> [!NOTE]
> The client SDK is published as `@mfe-orchestrator-hub/client` and this template depends on it at
> `^0.2.1`. A caret on a `0.x` version is deliberately narrow: it accepts `0.2.x`
> only, **not** `0.3.0`. The SDK is new and parts of its API are still settling, so that is the
> intended level of caution — the cost is that you have to widen this range yourself when the SDK
> moves to `0.3.0`, otherwise `pnpm install` fails to resolve it.

## Getting started

```bash
pnpm install
pnpm dev        # http://localhost:5173
pnpm build      # production build into dist/
```

## Project structure

```
.
├── .github/workflows/build-and-deploy.yml   # build + upload + Docker image
├── Dockerfile                               # standalone nginx deploy
├── nginx/no-cache.conf
├── index.html
├── src/
│   ├── app/app.component.ts                 # the whole shell, see the note below
│   ├── globals.d.ts                         # env types + remote module declarations
│   ├── main.ts                              # configure() lives here
│   └── telemetry.ts                         # Application Insights, when the environment asks for it
├── .env.example
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.json
├── tsconfig.app.json
└── vite.config.ts                           # federation config
```

## How the orchestrator is wired in

**The host never decides which version it gets.** It hands over the identities it holds and uses
the URL it receives, verbatim. Which version that URL points at — stable, canary, whatever — is
decided by the backend. Nothing in this repo parses a version, builds a URL by hand, or knows that
canaries exist.

Two pieces make that work.

**1. `configure()`, at the very top of the entry point (`src/main.ts`), synchronously, before
anything imports a remote:**

```ts
import { configure } from '@mfe-orchestrator-hub/client'

const environment = import.meta.env.VITE_MFE_ENVIRONMENT?.trim()

configure({
  backendUrl: import.meta.env.VITE_MFE_BACKEND_URL,
  projectId: import.meta.env.VITE_MFE_PROJECT_ID,
  ...(environment ? { environment } : {})
})
```

`backendUrl` and `projectId` are the only required options. **`environment` is optional**: omitted,
the client calls the *auto* route and the backend resolves the environment from the domain the page
is served on, out of the domains declared for each environment in the console. One build then serves
staging and production with no per deployment variable to set.

Neither the `?.trim()` nor the conditional spread is decoration. Vite has two ways of saying "not
set" — a variable missing from `.env` arrives as `undefined`, one declared with no value arrives as
an empty string — and the orchestrator must be handed neither `""` nor the string `"undefined"`; the
`?.trim()` also catches a value that is only whitespace. The spread then leaves the key out of the
object entirely rather than passing it as `undefined`, which is the same shape every other host
template emits. Set `VITE_MFE_ENVIRONMENT` when this host already knows which environment it belongs
to, or when a single domain has to serve several of them.

**2. The remote, declared in `vite.config.ts` as a promise that resolves to a URL:**

```js
federation({
  name: 'app',
  filename: 'remoteEntry.js',
  exposes: { './App': './src/...' },
  remotes: {
    exampleremote: {
      external: `import('@mfe-orchestrator-hub/client').then(m => m.remoteUrl('example-remote'))`,
      externalType: 'promise'
    }
  },
  shared: [...]
})
```

`remoteUrl('example-remote')` takes the **slug** of a microfrontend and returns the URL the backend
resolved for it, already pinned to a version. Rename the key and the slug to match your own
microfrontends, and add one entry per remote.

The SDK also exposes `manifest()`, `globalVariables()` and `identities()`, all used in this
template, so you can see what the environment actually returned.

## Application Insights

The host starts [Application Insights](https://learn.microsoft.com/azure/azure-monitor/app/javascript-sdk)
when its environment has a **global variable** named `APPLICATIONINSIGHTS_CONNECTION_STRING`. Set it
in the console, on each environment you want monitored, to the connection string of that
environment's Application Insights resource. The connection string only allows ingestion, so it is
fine in a browser.

Without the variable nothing happens: `src/telemetry.ts` loads `@microsoft/applicationinsights-web`
with a dynamic `import()`, so the SDK is a chunk of its own that is never downloaded, and the page
behaves exactly as before.

With it, the host initialises the SDK once and tracks:

- page views, the first one and every route change (`enableAutoRouteTracking`);
- unhandled exceptions, of the host and of every remote;
- `fetch` and XHR calls as dependencies, with W3C (`traceparent`, `tracestate`) and classic
  (`Request-Id`, `Request-Context`) correlation headers, so a backend that reports to Application
  Insights joins the same end-to-end transaction;
- browser timings (page load, network, DOM processing).

Everything is reported under the cloud role name `ROLE_NAME` (`vite-host-angular`): rename it in
`src/telemetry.ts` after your host, so it is told apart from the backends in the application map.

**Correlation with backends.** Correlation headers go to same-origin calls only, by default. To
correlate the calls to a backend on another host, add that host to `CORRELATED_HOSTS` in
`src/telemetry.ts` (`'api.example.com'`, or `'*.example.com'`), and make sure the backend's CORS
allows the request headers `traceparent`, `tracestate`, `Request-Id` and `Request-Context`:
otherwise the browser preflight fails and the call with it.

**Remotes.** The instance is published on `window.appInsights` once loaded, and remotes use that one
instead of bundling their own SDK. Exceptions, calls and page views of a remote are already
tracked; for custom telemetry:

```ts
window.appInsights?.trackEvent({ name: 'checkout-completed' }, { items: 3 })
window.appInsights?.trackException({ exception: error })
```

The optional chaining matters: `window.appInsights` is not there when the environment has no
connection string, nor before the SDK has finished loading, and a call made then is simply skipped.
In a TypeScript remote, declare the slice it uses, so it needs no dependency on the SDK:

```ts
declare global {
  interface Window {
    appInsights?: {
      trackEvent(event: { name: string }, properties?: Record<string, unknown>): void
      trackException(exception: { exception: Error }, properties?: Record<string, unknown>): void
    }
  }
}
```

## Environment variables

Copy `.env.example` to `.env` and fill it in. Vite injects them at build time.

| variable | required | what it is |
| --- | --- | --- |
| `VITE_MFE_BACKEND_URL` | yes | orchestrator backend, including the `/api` suffix |
| `VITE_MFE_PROJECT_ID` | yes | id of your project in the orchestrator |
| `VITE_MFE_ENVIRONMENT` | no | environment slug, ex. `DEV`. Unset: resolved by the backend from the domain |

`.env` is gitignored. Never commit real values.

> [!NOTE]
> These are the orchestrator's environment variables, and `VITE_MFE_ENVIRONMENT` holds the
> orchestrator's *environment slug*. Neither has anything to do with Angular's `environment.ts`
> configuration files, which this template does not use.

## Build output

`pnpm build` writes to `dist/`. The federation entry lands at **`dist/assets/remoteEntry.js`**, which is the `entryPoint` the marketplace entry declares.

Check it after any change to `vite.config.ts`: the orchestrator serves exactly that path, so a build that
puts the entry somewhere else is broken.

## Deploying

### Upload to the orchestrator

`.github/workflows/build-and-deploy.yml` builds the app and uploads `dist/` with
[`mfe-orchestrator/github-action`](https://github.com/mfe-orchestrator/github-action). It runs on
any pushed tag, or manually via *Run workflow*.

Configure these once, in the repository settings:

| kind | name | value |
| --- | --- | --- |
| secret | `MICROFRONTEND_ORCHESTRATOR_API_KEY` | your orchestrator API key |
| variable | `MICROFRONTEND_SLUG` | the slug of this host in the orchestrator |
| variable | `MICROFRONTEND_ORCHESTRATOR_DOMAIN` | your console URL, optional, defaults to `https://console.mfe-orchestrator.dev` |

The API key is a **secret**, never a variable and never a literal in the workflow file. If you
prefer hardcoding the two per project values instead of using repository variables, replace the
expressions in the `env:` block at the top of the workflow.

### Standalone deploy

A host is consumable as a remote, but it is also an application in its own right, so the same
workflow builds and pushes an nginx image to `ghcr.io/<owner>/<repo>`. `nginx/no-cache.conf` serves
`index.html` for any route and marks the entry files as never cacheable, so a redeploy is picked up
immediately.

```bash
docker build -t my-host .
docker run -p 8080:80 my-host
```

## Notes

- **The exposed component must stay self contained.** `@analogjs/vite-plugin-angular` does not compile the *local* imports of a module that `vite-plugin-federation` exposes: split `app.component.ts` into child components and the build fails with `"X is not exported by src/app/x.component.ts"`. That is why the whole shell lives in one file. If you want to split it, stop exposing it (drop `filename` and `exposes` from `vite.config.ts`) — but then this template no longer emits `assets/remoteEntry.js` and the orchestrator cannot serve it as a remote.
- Angular is compiled ahead of time by `@analogjs/vite-plugin-angular`. `@angular/build` is a required dev dependency of that plugin, even though nothing here uses the Angular CLI.
- Change detection is zoneless, so `zone.js` is never loaded. Drop `provideZonelessChangeDetection()` from `src/main.ts` and add `import 'zone.js'` if you want the zone based scheduler back.
- Remote modules are invisible to the compiler. Declare each one you import in `src/globals.d.ts`.

## License

MIT
