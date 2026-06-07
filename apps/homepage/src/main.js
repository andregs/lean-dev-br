// @ts-check
import './rum.js';
import './observer.js';
import './styles/main.css';
import { renderHome } from './views/home.js';
import { renderContact } from './views/contact.js';

/**
 * Tiny History-API view swapper — no router library. Each route renders into
 * the `#app` element; internal link clicks are intercepted for client-side nav.
 *
 * @type {Record<string, (root: HTMLElement) => void>}
 */
const routes = {
  '/': renderHome,
  '/contact': renderContact,
};

function render() {
  const app = document.querySelector('#app');
  if (!(app instanceof HTMLElement)) return;
  const view = routes[window.location.pathname] ?? renderHome;
  view(app);
}

/** @param {MouseEvent} event */
function onClick(event) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey) return;
  const target = event.target;
  const anchor = target instanceof Element ? target.closest('a') : null;
  if (!anchor) return;

  const href = anchor.getAttribute('href');
  if (href === null || anchor.target === '_blank') return;

  const url = new URL(href, window.location.href);
  if (url.origin !== window.location.origin) return;

  event.preventDefault();
  if (url.pathname !== window.location.pathname) {
    window.history.pushState(null, '', url.pathname);
    render();
    window.scrollTo(0, 0);
  }
}

document.addEventListener('click', onClick);
window.addEventListener('popstate', render);
render();
