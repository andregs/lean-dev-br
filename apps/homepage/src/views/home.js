// @ts-check

/**
 * Render the landing hero.
 * @param {HTMLElement} root
 */
export function renderHome(root) {
  root.className = 'hero';
  root.innerHTML = `
    <div class="hero-inner">
      <h1>Hi, I'm <span class="name">André</span>.</h1>

      <hr class="rule" />

      <p class="description">
        I'll publish about <strong>software engineering</strong> here.<br />
        Notes, demos, and experiments on building systems that are pleasant to
        maintain, easy to understand, and reliable in production.<span class="cursor" aria-hidden="true"></span>
      </p>
    </div>
  `;
}
