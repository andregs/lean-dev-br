import { Component, signal } from '@angular/core';
import type { ApiPaths } from '@lean-dev-br/wanderlust-contracts';
import { apiClient } from '@lean-dev-br/wanderlust-contracts';

export type Destination =
  ApiPaths['/destinations']['get']['responses']['200']['content']['application/json'][number];

// Placeholder route - real N+1 aggregation/optimization content lands in iteration 1.
// This component only proves the openapi contract -> apiClient -> MSW mock loop end-to-end.
@Component({
  selector: 'app-home',
  standalone: true,
  template: `
    <main class="home">
      <h1>Hello, Wanderlust</h1>
      <p>The trip planner showcase — under construction.</p>
      <ul class="destinations">
        @for (destination of destinations(); track destination.id) {
          <li>
            <strong>{{ destination.name }}</strong
            >, {{ destination.country }}
            <p>{{ destination.description }}</p>
          </li>
        }
      </ul>
    </main>
  `,
  styles: `
    :host {
      display: contents;
    }
    .home {
      padding: clamp(5.5rem, 17vh, 10rem) var(--pad-x) 3rem;
      max-width: var(--content-width);
      margin: 0 auto;
      flex: 1;
    }
    .destinations {
      list-style: none;
      margin-top: 2rem;
      display: grid;
      gap: 1.5rem;
    }
  `,
})
export class Home {
  protected readonly destinations = signal<Destination[]>([]);

  constructor() {
    void this.loadDestinations();
  }

  private async loadDestinations(): Promise<void> {
    const { data, error } = await apiClient.GET('/destinations');
    if (error) return;
    this.destinations.set(data);
  }
}
