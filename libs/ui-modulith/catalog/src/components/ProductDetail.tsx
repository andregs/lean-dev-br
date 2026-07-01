import { useBus } from '@lean-dev-br/ui-modulith-kernel';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { type Product, getProduct } from '../api';
import styles from './Catalog.module.css';

export function ProductDetail() {
  const { sku = '' } = useParams<{ sku: string }>();
  const { t } = useTranslation('common');
  const bus = useBus();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    setLoading(true);
    setProduct(null);
    getProduct(sku)
      .then(setProduct)
      .catch(() => {
        setProduct(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [sku]);

  function addToCart() {
    if (!product) return;
    bus.emit('cart/add', {
      sku: product.sku,
      name: product.name,
      price: product.price,
      qty: 1,
    });
    setAdded(true);
    const timer = setTimeout(() => {
      setAdded(false);
    }, 2000);
    return () => {
      clearTimeout(timer);
    };
  }

  return (
    <section className={styles.section}>
      <Link to="/catalog" className={styles.backLink}>
        {t('catalog.back')}
      </Link>

      {loading && (
        <div
          className={`${styles.detailSkeleton} ${styles.skeleton}`}
          aria-label="Loading product"
        />
      )}

      {!loading && !product && <p className={styles.error}>{t('catalog.not-found')}</p>}

      {!loading && product && (
        <div className={styles.detail}>
          <div className={styles.detailImage}>
            <span className={styles.skuBadge}>{product.sku}</span>
          </div>
          <div className={styles.detailInfo}>
            <h1 className={styles.detailName}>{product.name}</h1>
            <p className={styles.price}>${product.price.toFixed(2)}</p>
            <p className={styles.detailDescription}>{product.description}</p>
            <button className={styles.detailAddBtn} onClick={addToCart} disabled={added}>
              {added ? `✓ ${t('cart.added')}` : t('catalog.add-to-cart')}
            </button>
            {added && <p className={styles.addedNote}>{t('cart.added')}</p>}
          </div>
        </div>
      )}
    </section>
  );
}
