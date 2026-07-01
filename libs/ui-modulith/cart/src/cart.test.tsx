import { StrictMode } from 'react';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18nextLib from 'i18next';
import { describe, it, expect } from 'vitest';
import { BusProvider, useBus, type ProductSnapshot } from '@lean-dev-br/ui-modulith-kernel';
import { CartPage } from './components/CartPage';

const i18n = i18nextLib.createInstance();
void i18n.use(initReactI18next).init({
  lng: 'en-US',
  ns: ['common'],
  defaultNS: 'common',
  resources: {
    'en-US': {
      common: {
        'cart.heading': 'Cart',
        'cart.empty': 'Your cart is empty.',
        'cart.browse': 'Browse catalog →',
        'cart.total': 'Total',
        'cart.item-count_one': '{{count}} item',
        'cart.item-count_other': '{{count}} items',
        'cart.qty': 'Qty',
      },
    },
  },
  keySeparator: false,
  nsSeparator: ':',
  interpolation: { escapeValue: false },
});

const WIDGET: ProductSnapshot = { sku: 'WIDGET-001', name: 'Super Widget', price: 29.99, qty: 1 };
const GADGET: ProductSnapshot = { sku: 'GADGET-002', name: 'Power Gadget', price: 49.99, qty: 2 };

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

function renderCart(extra?: React.ReactNode) {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <BusProvider>
          {extra}
          <CartPage />
        </BusProvider>
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('CartPage', () => {
  it('shows the empty state with no items', () => {
    renderCart();
    expect(screen.getByText('Your cart is empty.')).not.toBeNull();
  });

  it('renders a line item added via the bus', () => {
    renderCart(<AddButton product={WIDGET} />);
    act(() => {
      screen.getByText('add WIDGET-001').click();
    });
    expect(screen.getByText('Super Widget')).not.toBeNull();
    expect(screen.getByText('$29.99')).not.toBeNull();
  });

  it('aggregates quantity when the same sku is added twice', () => {
    renderCart(<AddButton product={WIDGET} />);
    act(() => {
      screen.getByText('add WIDGET-001').click();
      screen.getByText('add WIDGET-001').click();
    });
    expect(screen.getByText('Qty 2')).not.toBeNull();
    expect(screen.getByText('$59.98')).not.toBeNull();
  });

  it('computes the total across multiple lines', () => {
    renderCart(
      <>
        <AddButton product={WIDGET} />
        <AddButton product={GADGET} />
      </>,
    );
    act(() => {
      screen.getByText('add WIDGET-001').click();
      screen.getByText('add GADGET-002').click();
    });
    expect(screen.getByText('Total: $129.97')).not.toBeNull();
  });

  it('reflects items added before the cart page ever mounted', () => {
    // The cart route is lazy-loaded, so items are routinely added to the bus
    // before CartPage exists at all — the bus's replay-on-subscribe is what
    // reconstructs the full cart once it finally mounts.
    const tree = (cartMounted: boolean) => (
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>
          <BusProvider>
            <AddButton product={WIDGET} />
            {cartMounted && <CartPage />}
          </BusProvider>
        </MemoryRouter>
      </I18nextProvider>
    );

    const { rerender } = render(tree(false));
    act(() => {
      screen.getByText('add WIDGET-001').click();
    });

    // BusProvider isn't remounted here, so it keeps the same bus instance.
    rerender(tree(true));

    expect(screen.getByText('Super Widget')).not.toBeNull();
  });

  it('does not double-count replayed events under Strict Mode remount', () => {
    // Strict Mode double-invokes effects in dev (mount→cleanup→remount) to surface
    // exactly this kind of bug: a naive accumulator would replay buffered events twice.
    render(
      <StrictMode>
        <I18nextProvider i18n={i18n}>
          <MemoryRouter>
            <BusProvider>
              <AddButton product={WIDGET} />
              <CartPage />
            </BusProvider>
          </MemoryRouter>
        </I18nextProvider>
      </StrictMode>,
    );
    act(() => {
      screen.getByText('add WIDGET-001').click();
    });

    expect(screen.getByText('Qty 1')).not.toBeNull();
    expect(screen.getByText('$29.99')).not.toBeNull();
  });
});
