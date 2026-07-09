import { Component, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import type { ApiPaths } from '@lean-dev-br/wanderlust-contracts';
import { apiClient } from '@lean-dev-br/wanderlust-contracts';

export type Destination =
  ApiPaths['/destinations']['get']['responses']['200']['content']['application/json'][number];

// WMO weather interpretation codes (https://open-meteo.com/en/docs), collapsed to the icon set
// this showcase actually renders.
const WEATHER_ICONS: Record<number, string> = {
  0: '☀️',
  1: '🌤️',
  2: '⛅',
  3: '☁️',
  45: '🌫️',
  48: '🌫️',
  61: '🌧️',
  63: '🌧️',
  65: '🌧️',
  71: '🌨️',
  73: '🌨️',
  75: '🌨️',
  95: '⛈️',
};

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [DecimalPipe],
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
            @if (destination.weather; as weather) {
              <p class="destination-weather">
                <span class="destination-weather-icon">{{ weatherIcon(weather.weatherCode) }}</span>
                {{ weather.temperatureC | number: '1.0-0' }}°C
              </p>
            }
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
    .destination-weather {
      margin-top: 0.5rem;
      font-size: 1.1rem;
    }
    .destination-weather-icon {
      margin-right: 0.35rem;
    }
  `,
})
export class Home {
  protected readonly destinations = signal<Destination[]>([]);

  constructor() {
    void this.loadDestinations();
  }

  protected weatherIcon(code: number): string {
    return WEATHER_ICONS[code] ?? '🌡️';
  }

  private async loadDestinations(): Promise<void> {
    const { data, error } = await apiClient.GET('/destinations');
    if (error) return;
    this.destinations.set(data);
  }
}
