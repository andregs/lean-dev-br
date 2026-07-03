import { StrictMode } from 'react';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18nextLib from 'i18next';
import { describe, it, expect } from 'vitest';
import { BusProvider, useBus, type ProductSnapshot } from '@lean-dev-br/federation-kernel';
import { DemoBar } from './DemoBar';

const i18n = i18nextLib.createInstance();
void i18n.use(initReactI18next).init({
  lng: 'en-US',
  ns: ['common'],
  defaultNS: 'common',
  resources: {
    'en-US': {
      common: { 'nav.labs': 'Labs', 'demo.title': 'Module Federation', 'cart.heading': 'Cart' },
    },
  },
  keySeparator: false,
  nsSeparator: ':',
  interpolation: { escapeValue: false },
});

const WIDGET: ProductSnapshot = { sku: 'WIDGET-001', name: 'Super Widget', price: 29.99, qty: 1 };

function AddButton({ product }: { product: ProductSnapshot }) {
  const bus = useBus();
  return (
    <button
      onClick={() => {
        bus.emit('cart/add', product);
      }}
    >
      add {product.sku}
    </button>
  );
}

describe('DemoBar', () => {
  it('shows no badge when the cart is empty', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>
          <BusProvider>
            <DemoBar />
          </BusProvider>
        </MemoryRouter>
      </I18nextProvider>,
    );
    expect(screen.getByText('🛒 Cart')).not.toBeNull();
    expect(screen.queryByText('1')).toBeNull();
  });

  it('increments the badge count when cart/add is emitted', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>
          <BusProvider>
            <AddButton product={WIDGET} />
            <DemoBar />
          </BusProvider>
        </MemoryRouter>
      </I18nextProvider>,
    );
    act(() => {
      screen.getByText('add WIDGET-001').click();
    });
    expect(screen.getByText('1')).not.toBeNull();
  });

  it('reflects items added before it mounted, via the bus replay', () => {
    const tree = (barMounted: boolean) => (
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>
          <BusProvider>
            <AddButton product={WIDGET} />
            {barMounted && <DemoBar />}
          </BusProvider>
        </MemoryRouter>
      </I18nextProvider>
    );

    const { rerender } = render(tree(false));
    act(() => {
      screen.getByText('add WIDGET-001').click();
    });

    rerender(tree(true));
    expect(screen.getByText('1')).not.toBeNull();
  });

  it('does not double-count replayed events under Strict Mode remount', () => {
    render(
      <StrictMode>
        <I18nextProvider i18n={i18n}>
          <MemoryRouter>
            <BusProvider>
              <AddButton product={WIDGET} />
              <DemoBar />
            </BusProvider>
          </MemoryRouter>
        </I18nextProvider>
      </StrictMode>,
    );
    act(() => {
      screen.getByText('add WIDGET-001').click();
    });
    expect(screen.getByText('1')).not.toBeNull();
    expect(screen.queryByText('2')).toBeNull();
  });
});
