// @ts-check
import { installPolicies, setHTML } from '@lean-dev-br/trusted-types';

installPolicies();

export { setHTML };

/**
 * Create <svg aria-hidden><use href="/todo/icons.svg#{symbolId}"/></svg>.
 * Uses the DOM API directly — DOMPurify strips external <use href>, so we bypass it.
 * Safe: href is a hardcoded first-party path, never user input.
 * @param {string} symbolId
 * @returns {SVGSVGElement}
 */
export function svgIcon(symbolId) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `/todo/icons.svg#${symbolId}`);
  svg.append(use);
  return /** @type {SVGSVGElement} */ (svg);
}
