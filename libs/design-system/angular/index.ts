// Convenience aggregate for non-Angular-dev-server consumers. Angular apps
// should import each component via its own subpath
// (@lean-dev-br/design-system/angular/site-nav) instead of this barrel -
// Angular's dev-server dependency-optimization scan can't resolve the
// relative imports this file would otherwise require it to follow.
export { SiteNav } from './site-nav';
export { SiteFooter } from './site-footer';
