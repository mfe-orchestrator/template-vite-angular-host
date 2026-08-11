# Vite & Angular — host template

Starter template for the [MFE Orchestrator](https://github.com/mfe-orchestrator), listed in the
marketplace as `vite-host-angular`. Vite + Angular 21, wired as a **host**.

## Requirements

- Node.js 20 or newer
- [pnpm](https://pnpm.io) 10 or newer

> [!IMPORTANT]
> `pnpm install` currently fails with a 404 on `@mfe-orchestrator/client`: the client SDK is not
> published to a registry yet. That single dependency is the only thing missing — everything
> else in this template installs and builds. Until it is published, either wait for it or point
> the dependency at a local checkout of the SDK.

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
│   └── main.ts                              # configure() lives here
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
import { configure } from '@mfe-orchestrator/client'

configure({
  backendUrl: import.meta.env.VITE_MFE_BACKEND_URL,
  projectId: import.meta.env.VITE_MFE_PROJECT_ID,
  environment: import.meta.env.VITE_MFE_ENVIRONMENT
})
```

**2. The remote, declared in `vite.config.ts` as a promise that resolves to a URL:**

```js
federation({
  name: 'app',
  filename: 'remoteEntry.js',
  exposes: { './App': './src/...' },
  remotes: {
    exampleremote: {
      external: `import('@mfe-orchestrator/client').then(m => m.remoteUrl('example-remote'))`,
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

## Environment variables

Copy `.env.example` to `.env` and fill it in. Vite injects them at build time.

| variable | what it is |
| --- | --- |
| `VITE_MFE_BACKEND_URL` | orchestrator backend, including the `/api` suffix |
| `VITE_MFE_PROJECT_ID` | id of your project in the orchestrator |
| `VITE_MFE_ENVIRONMENT` | environment slug, ex. `DEV` |

`.env` is gitignored. Never commit real values.

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
| variable | `ORCHESTRATOR_DOMAIN` | your console URL, optional, defaults to `https://console.mfe-orchestrator.dev` |

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
