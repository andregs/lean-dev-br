// @ts-check
import './rum.js';
import './observer.js';
import './styles/main.css';
import { renderHome } from './views/home.js';
import { renderContact } from './views/contact.js';
import { renderLabs } from './views/labs.js';
import { renderNotFound } from './views/not-found.js';

/**
 * Tiny History-API view swapper — no router library. Each route renders into
 * the `#app` element; internal link clicks are intercepted for client-side nav.
 *
 * @type {Record<string, (root: HTMLElement) => void>}
 */
const routes = {
  '/': renderHome,
  '/contact': renderContact,
  '/labs': renderLabs,
};

function render() {
  const app = document.querySelector('#app');
  if (!(app instanceof HTMLElement)) return;
  const path = window.location.pathname;
  // The reCAPTCHA badge is injected onto document.body and survives view swaps;
  // CSS gates its visibility to the contact route via this class.
  document.body.classList.toggle('route-contact', path === '/contact');
  const view = routes[path] ?? renderNotFound;
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
  if (!(url.pathname in routes)) return;

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
