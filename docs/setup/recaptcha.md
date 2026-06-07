# reCAPTCHA Setup

The contact form uses **reCAPTCHA v3** (score-based, invisible to users) to block bot submissions. You need two keys: a public site key and a private secret key.

## 1. Register a site

Go to https://www.google.com/recaptcha/admin/create (Google account required).

- **Label**: lean.dev.br (any identifier)
- **reCAPTCHA type**: Score based (v3)
- **Domains**: add `lean.dev.br` and `localhost` (localhost allows local dev without disabling the check)
- Accept terms → Submit

You will see two keys:

| Key | Visibility | Used where |
|---|---|---|
| **Site key** | Public — safe to expose in JS | Vite build, embedded in the bundle |
| **Secret key** | Private — never expose | Lambda env var, verified server-side |

## 2. Store the secret key in Pulumi

```zsh
cd infra/homepage
pulumi config set --secret recaptchaSecret <your-secret-key>
```

This encrypts the value and stores it in Pulumi Cloud state. `pulumi up` injects it as the Lambda's `RECAPTCHA_SECRET` environment variable.

## 3. Store the site key as a GitHub Actions variable

In the GitHub repository → **Settings → Secrets and variables → Actions → Variables → New repository variable**:

| Variable name | Value |
|---|---|
| `VITE_RECAPTCHA_SITE_KEY` | Your site key |

Variables (not secrets) are appropriate here — the site key is public and embedded in the JS bundle.

## 4. Local development

For local testing, create `apps/homepage/.env.local` (git-ignored):

```
VITE_RECAPTCHA_SITE_KEY=<your-site-key>
```

The Lambda also needs the secret key locally if you run it directly, but unit tests mock reCAPTCHA so it is not required for `nx test contact-api`.

## Notes

- reCAPTCHA v3 returns a score from 0.0 (bot) to 1.0 (human). The threshold lives in Pulumi config as `recaptchaMinScore` (injected as the Lambda's `MIN_SCORE`). Tune it via `pulumi config set recaptchaMinScore 0.3` — lower it if low-traffic/new-site scores cause flaky rejects.
- v3 is frictionless — it never shows a checkbox or image challenge. A low score simply fails server-side. A visible challenge would require reCAPTCHA v2 or Enterprise.
- The expected action lives in Pulumi config as `recaptchaAction` (injected as `RECAPTCHA_ACTION`); submissions with a different action are rejected even if the score is passing.
- Google's admin console at https://www.google.com/recaptcha/admin shows score distributions per site key. Check it after the first real traffic.
