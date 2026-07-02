// vi.mock is hoisted by Vitest — must appear before other imports.
// openapi-fetch constructs `new Request(relativeUrl)` which throws in Node.js;
// mocking the kernel's apiClient with an absolute base URL avoids that.
import { vi } from 'vitest';

vi.mock('@lean-dev-br/ui-modulith-kernel', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@lean-dev-br/ui-modulith-kernel')>();
  const { default: createClient } = await import('openapi-fetch');
  return {
    ...orig,
    // createClient snapshots `fetch` as a default param at call time — capture a
    // pass-through instead so it re-reads globalThis.fetch per request, after MSW patches it.
    apiClient: createClient({
      baseUrl: 'http://localhost/labs/ui-modulith/api',
      fetch: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args),
    }),
  };
});

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18nextLib from 'i18next';
import { useEffect } from 'react';
import { describe, it, expect } from 'vitest';
import { BusProvider, useBus, type ProductSnapshot } from '@lean-dev-br/ui-modulith-kernel';
import { CatalogPage } from './components/CatalogPage';
import { ProductDetail } from './components/ProductDetail';

// ── i18n ────────────────────────────────────────────────────
const i18n = i18nextLib.createInstance();
void i18n.use(initReactI18next).init({
  lng: 'en-US',
  ns: ['common'],
  defaultNS: 'common',
  resources: {
    'en-US': {
      common: {
        'catalog.heading': 'Catalog',
        'catalog.add-to-cart': 'Add to cart',
        'catalog.back': '← Back to catalog',
        'catalog.not-found': 'Product not found.',
        'cart.added': 'Added to cart',
        'nav.labs': 'Labs',
        'demo.title': 'Frontend Modulith',
      },
    },
    'pt-BR': { common: {} },
  },
  keySeparator: false,
  nsSeparator: ':',
  interpolation: { escapeValue: false },
});

// ── Test helpers ────────────────────────────────────────────

function CartCapture({ onAdd }: { onAdd: (p: ProductSnapshot) => void }) {
  const bus = useBus();
  useEffect(() => bus.on('cart/add', onAdd), [bus, onAdd]);
  return null;
}

function renderPage(ui: React.ReactElement, path: string, routePattern: string) {
  const onAdd = vi.fn<(p: ProductSnapshot) => void>();
  render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={[path]}>
        <BusProvider>
          <CartCapture onAdd={onAdd} />
          <Routes>
            <Route path={routePattern} element={ui} />
          </Routes>
        </BusProvider>
      </MemoryRouter>
    </I18nextProvider>,
  );
  return { onAdd };
}

// ── CatalogPage ─────────────────────────────────────────────

describe('CatalogPage', () => {
  it('shows skeleton while loading', () => {
    renderPage(<CatalogPage />, '/', '/');
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it('renders product names after data loads', async () => {
    renderPage(<CatalogPage />, '/', '/');
    await waitFor(() => {
      expect(screen.getByText('Super Widget')).not.toBeNull();
      expect(screen.getByText('Power Gadget')).not.toBeNull();
    });
  });

  it('renders price for each product', async () => {
    renderPage(<CatalogPage />, '/', '/');
    await waitFor(() => {
      expect(screen.getByText('$29.99')).not.toBeNull();
      expect(screen.getByText('$49.99')).not.toBeNull();
    });
  });

  it('emits cart/add on the bus when Add to cart is clicked', async () => {
    const { onAdd } = renderPage(<CatalogPage />, '/', '/');
    await waitFor(() => screen.getAllByText('Add to cart'));

    fireEvent.click(screen.getAllByText('Add to cart')[0]);

    expect(onAdd).toHaveBeenCalledOnce();
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ sku: 'WIDGET-001', qty: 1 }));
  });
});

// ── ProductDetail ───────────────────────────────────────────

describe('ProductDetail', () => {
  function renderDetail(sku: string) {
    return renderPage(<ProductDetail />, `/${sku}`, '/:sku');
  }

  it('renders product name, price and description', async () => {
    renderDetail('WIDGET-001');
    await waitFor(() => {
      expect(screen.getByText('Super Widget')).not.toBeNull();
      expect(screen.getByText('$29.99')).not.toBeNull();
      expect(screen.getByText('A very fine widget.')).not.toBeNull();
    });
  });

  it('shows not-found message for unknown SKU', async () => {
    renderDetail('NONEXISTENT');
    await waitFor(() => {
      expect(screen.getByText('Product not found.')).not.toBeNull();
    });
  });

  it('emits cart/add and shows added confirmation', async () => {
    const { onAdd } = renderDetail('WIDGET-001');
    await waitFor(() => screen.getByText('Add to cart'));

    fireEvent.click(screen.getByText('Add to cart'));

    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ sku: 'WIDGET-001', price: 29.99, qty: 1 }),
    );
    expect(screen.getByText('✓ Added to cart')).not.toBeNull();
  });

  it('disables add button while added state is active', async () => {
    renderDetail('WIDGET-001');
    await waitFor(() => screen.getByText('Add to cart'));

    fireEvent.click(screen.getByText('Add to cart'));

    const btn = screen.getByRole<HTMLButtonElement>('button', { name: /added/i });
    expect(btn.disabled).toBe(true);
  });
});
