import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useBus } from '@lean-dev-br/federation-kernel';
import styles from './DemoBar.module.css';

export function DemoBar() {
  const { t } = useTranslation('common');
  const bus = useBus();
  const [cartCount, setCartCount] = useState(0);
  const countRef = useRef(0);

  useEffect(() => {
    // bus.on replays every past cart/add event synchronously on subscribe. Resetting
    // first makes this idempotent if the effect re-subscribes (e.g. Strict Mode's
    // mount→cleanup→remount) — otherwise the replay would double-count. This badge
    // is the shell's own proof that the bus crosses the remote boundary: it updates
    // from events emitted inside the catalog remote's own bundle.
    countRef.current = 0;
    return bus.on('cart/add', (payload) => {
      countRef.current += payload.qty;
      setCartCount(countRef.current);
    });
  }, [bus]);

  return (
    <div className={styles.bar}>
      <div className={styles.inner}>
        <nav className={styles.breadcrumb} aria-label="Demo navigation">
          <a href="/labs">{t('nav.labs')}</a>
          <span aria-hidden="true">›</span>
          <span>{t('demo.title')}</span>
        </nav>
        <Link to="/cart" className={styles.cartLink}>
          🛒 {t('cart.heading')}
          {cartCount > 0 && <span className={styles.cartCount}>{cartCount}</span>}
        </Link>
      </div>
    </div>
  );
}
