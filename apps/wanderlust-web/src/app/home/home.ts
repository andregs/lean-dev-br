import { Component } from '@angular/core';

// Placeholder route - real content (destinations list) lands in iteration 1.
@Component({
  selector: 'app-home',
  standalone: true,
  template: `
    <main class="home">
      <h1>Hello, Wanderlust</h1>
      <p>The trip planner showcase — under construction.</p>
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
  `,
})
export class Home {}
