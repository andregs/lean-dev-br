import { Component } from '@angular/core';

// Markup contract shared with the React SiteFooter (libs/design-system/react/SiteFooter.tsx):
// footer.site-footer > .footer-inner > two children (see footer.css).
@Component({
  selector: 'lean-site-footer',
  standalone: true,
  template: `
    <footer class="site-footer">
      <div class="footer-inner">
        <span>25.43°S 49.27°W</span>
        <a
          class="footer-link"
          href="https://github.com/andregs/lean-dev-br"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub
        </a>
      </div>
    </footer>
  `,
})
export class SiteFooter {}
