import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useBus } from '@lean-dev-br/ui-modulith-kernel';
import type { Product } from '../api';
import styles from './Catalog.module.css';

interface Props {
  product: Product;
}

export function ProductCard({ product }: Props) {
  const { t } = useTranslation('common');
  const bus = useBus();

  function addToCart() {
    bus.emit('cart/add', {
      sku: product.sku,
      name: product.name,
      price: product.price,
      qty: 1,
    });
  }

  return (
    <article className={styles.card}>
      <Link
        to={`/catalog/${product.sku}`}
        className={styles.imageSlotLink}
        tabIndex={-1}
        aria-hidden="true"
      >
        <div className={styles.imageSlot}>
          <span className={styles.skuBadge}>{product.sku}</span>
        </div>
      </Link>
      <div className={styles.cardBody}>
        <Link to={`/catalog/${product.sku}`} className={styles.productName}>
          {product.name}
        </Link>
        <p className={styles.description}>{product.description}</p>
        <div className={styles.cardFooter}>
          <span className={styles.price}>${product.price.toFixed(2)}</span>
          <button className={styles.addBtn} onClick={addToCart}>
            {t('catalog.add-to-cart')}
          </button>
        </div>
      </div>
    </article>
  );
}
