import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCartLines } from '../store';
import styles from './Cart.module.css';

export function CartPage() {
  const { t } = useTranslation('common');
  const lines = useCartLines();
  const itemCount = lines.reduce((sum, line) => sum + line.qty, 0);
  const total = lines.reduce((sum, line) => sum + line.price * line.qty, 0);

  return (
    <section className={styles.section}>
      <p className={styles.moduleLabel}>cart</p>
      <h1 className={styles.heading}>{t('cart.heading')}</h1>

      {lines.length === 0 ? (
        <div className={styles.empty}>
          <p>{t('cart.empty')}</p>
          <Link to="/catalog" className={styles.browseLink}>
            {t('cart.browse')}
          </Link>
        </div>
      ) : (
        <>
          <ul className={styles.lines} role="list">
            {lines.map((line) => (
              <li key={line.sku} className={styles.line}>
                <div className={styles.lineInfo}>
                  <span className={styles.lineName}>{line.name}</span>
                  <span className={styles.lineSku}>{line.sku}</span>
                </div>
                <span className={styles.lineQty}>
                  {t('cart.qty')} {line.qty}
                </span>
                <span className={styles.linePrice}>${(line.price * line.qty).toFixed(2)}</span>
              </li>
            ))}
          </ul>

          <div className={styles.summary}>
            <span>{t('cart.item-count', { count: itemCount })}</span>
            <span className={styles.total}>
              {t('cart.total')}: ${total.toFixed(2)}
            </span>
          </div>
        </>
      )}
    </section>
  );
}
