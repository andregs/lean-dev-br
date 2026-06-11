// @ts-check
import './styles.css';
import { setHTML } from './trusted-types.js';

const app = /** @type {HTMLElement} */ (document.getElementById('app'));
app.className = 'todo';

setHTML(
  app,
  `<div class="todo-inner">
    <h1>Todo</h1>
    <hr class="rule" />
    <p class="description">Coming soon.</p>
  </div>`,
);
