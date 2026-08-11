// configure() must run at the very top of the entry point, synchronously, before
// anything imports a remote. It is idempotent.
import { configure } from '@mfe-orchestrator-hub/client'

// The orchestrator environment (the slug, ex. "DEV") is optional, and Vite has two ways of
// saying "not set": a variable missing from .env arrives as undefined, one declared with no
// value arrives as an empty string. Neither is a usable slug, so `||` collapses both to
// undefined — the orchestrator must never be handed "" or the string "undefined".
//
// Left undefined, the backend resolves the environment from the domain this page is served
// on, out of the domains declared for each environment in the console. Set
// VITE_MFE_ENVIRONMENT to pin it instead.
const environment = import.meta.env.VITE_MFE_ENVIRONMENT || undefined

configure({
  backendUrl: import.meta.env.VITE_MFE_BACKEND_URL,
  projectId: import.meta.env.VITE_MFE_PROJECT_ID,
  environment
})

import { provideZonelessChangeDetection } from '@angular/core'
import { bootstrapApplication } from '@angular/platform-browser'
import { AppComponent } from './app/app.component'

// Zoneless change detection, so no zone.js polyfill has to be loaded here. If you
// prefer the zone based scheduler, drop the provider and add `import 'zone.js'`
// at the top of this file instead.
bootstrapApplication(AppComponent, {
  providers: [provideZonelessChangeDetection()]
}).catch(err => console.error(err))
