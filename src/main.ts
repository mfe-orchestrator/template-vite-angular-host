// configure() must run at the very top of the entry point, synchronously, before
// anything imports a remote. It is idempotent.
import { configure } from '@mfe-orchestrator-hub/client'

configure({
  backendUrl: import.meta.env.VITE_MFE_BACKEND_URL,
  projectId: import.meta.env.VITE_MFE_PROJECT_ID,
  environment: import.meta.env.VITE_MFE_ENVIRONMENT
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
