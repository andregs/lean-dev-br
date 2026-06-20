import { test, expect, type BrowserContext } from '@playwright/test';
import { todoPath } from '../playwright.config';

// The todo app uses WebAuthn passkeys with the PRF extension to derive an AES
// encryption key. Playwright's virtual authenticator does not implement PRF,
// so we inject a lightweight mock via addInitScript that:
//  - handles navigator.credentials.create() (registration)
//  - handles navigator.credentials.get()  (authentication + PRF output)
// The synthetic PRF bytes are fixed so the AES key is deterministic within a
// test session. The key-provider then saves the derived session to IndexedDB,
// which survives page.reload() without re-invoking WebAuthn.

const FAKE_CRED_ID = [1, 2, 3, 4, 5, 6, 7, 8] as const;

// 32 bytes of synthetic PRF output — valid HKDF key material.
const FAKE_PRF = Array.from({ length: 32 }, (_, i) => i + 1);

async function installCredentialsMock(context: BrowserContext) {
  await context.addInitScript(
    ({ credId, prf }: { credId: number[]; prf: number[] }) => {
      const rawId = new Uint8Array(credId).buffer;
      const prfFirst = new Uint8Array(prf).buffer;
      const fakeCredential = {
        rawId,
        getClientExtensionResults: () => ({
          prf: { enabled: true, results: { first: prfFirst } },
        }),
      };
      Object.defineProperty(navigator, 'credentials', {
        configurable: true,
        get: () => ({
          create: () => Promise.resolve(fakeCredential),
          get: () => Promise.resolve(fakeCredential),
        }),
      });
    },
    { credId: [...FAKE_CRED_ID], prf: FAKE_PRF },
  );
}

test('register passkey, add todo, reload — todo persists', { tag: ['@dev-only'] }, async ({
  page,
  context,
}) => {
  await installCredentialsMock(context);
  await page.goto(todoPath('/'));

  // Setup screen: click "Create" to register a new passkey.
  await page.click('#setup-btn');

  // Wait for notebook to render after successful auth.
  await expect(page.locator('.notebook')).toBeVisible({ timeout: 15_000 });

  // Add a todo via the form.
  const todoText = 'e2e passkey test task';
  await page.fill('#todo-input', todoText);
  await page.press('#todo-input', 'Enter');

  await expect(page.locator('.todo-list')).toContainText(todoText);

  // Reload — restoreSession() reads from IndexedDB, skips WebAuthn entirely.
  await page.reload();
  await expect(page.locator('.notebook')).toBeVisible({ timeout: 10_000 });

  // Todo must survive the reload (Yjs persistence via IndexedDB).
  await expect(page.locator('.todo-list')).toContainText(todoText);
});
