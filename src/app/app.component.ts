import {
  Component,
  OnInit,
  ViewContainerRef,
  inject,
  signal,
  type Type
} from '@angular/core'
import {
  globalVariables,
  identities,
  manifest,
  type MicrofrontendEntry
} from '@mfe-orchestrator/client'

/**
 * The whole shell lives in this one file on purpose.
 *
 * This component is exposed through Module Federation (see vite.config.ts), and
 * @analogjs/vite-plugin-angular does not compile the *local* imports of an exposed
 * module when vite-plugin-federation is in play: splitting this into child
 * components makes the build fail with "X is not exported by ...". Keep an exposed
 * component self contained, or stop exposing it.
 */
@Component({
  selector: 'app-root',
  standalone: true,
  template: `
    <h1>Module Federation host</h1>
    <p>Vite + Angular + MFE Orchestrator</p>
    <p>
      This host resolves its remotes through the orchestrator: it never knows, and
      never chooses, which version it is served.
    </p>

    <!-- Example remote, declared in vite.config.ts. -->
    @if (remoteState() === 'loading') {
      <span>Loading remote…</span>
    }
    @if (remoteState() === 'error') {
      <span class="warn">{{ remoteMessage() }}</span>
    }

    <section>
      <h2>Environment</h2>
      @if (error()) {
        <p class="warn">{{ error() }}</p>
      } @else {
        <ul>
          @for (mfe of microfrontends(); track mfe.slug) {
            <li>
              <strong>{{ mfe.name }}</strong> ({{ mfe.slug }}) — served version
              {{ mfe.version }}
            </li>
          }
        </ul>
        <ul>
          @for (entry of variables(); track entry[0]) {
            <li>{{ entry[0] }} = {{ entry[1] }}</li>
          }
        </ul>
      }
      <p class="ids">session {{ ids.sessionId }} · device {{ ids.deviceId }}</p>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
        font-family: system-ui, Avenir, Helvetica, Arial, sans-serif;
        max-width: 960px;
        margin: 0 auto;
        padding: 2rem;
      }

      .warn {
        color: #b4530a;
      }

      .ids {
        color: #888;
        font-size: 0.8rem;
      }
    `
  ]
})
export class AppComponent implements OnInit {
  readonly microfrontends = signal<MicrofrontendEntry[]>([])
  readonly variables = signal<Array<[string, string]>>([])
  readonly error = signal('')
  readonly remoteState = signal<'loading' | 'ready' | 'error'>('loading')
  readonly remoteMessage = signal('')
  readonly ids = identities()

  private readonly viewContainer = inject(ViewContainerRef)

  async ngOnInit(): Promise<void> {
    void this.loadEnvironment()
    void this.loadExampleRemote()
  }

  private async loadEnvironment(): Promise<void> {
    try {
      const [data, vars] = await Promise.all([manifest(), globalVariables()])
      this.microfrontends.set(data.microfrontends ?? [])
      this.variables.set(Object.entries(vars))
    } catch (error) {
      this.error.set((error as Error).message)
    }
  }

  /**
   * Module Federation turns this bare import into a request to the URL the
   * orchestrator resolved, so nothing here ever sees a URL or a version.
   * Rename "exampleremote" and its slug in vite.config.ts, or delete both.
   */
  private async loadExampleRemote(): Promise<void> {
    try {
      const module: Record<string, unknown> = await import('exampleremote/Button')
      const component = (module['default'] ??
        Object.values(module).find(value => typeof value === 'function')) as
        | Type<unknown>
        | undefined

      if (!component) {
        throw new Error('the remote module exports no component')
      }

      this.viewContainer.createComponent(component)
      this.remoteState.set('ready')
    } catch (error) {
      this.remoteMessage.set(
        `Remote not available (${(error as Error).message}). Point vite.config.ts at one of your own slugs.`
      )
      this.remoteState.set('error')
    }
  }
}
