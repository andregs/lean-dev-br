import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type Product, listProducts } from '../api';
import { ProductCard } from './ProductCard';
import styles from './Catalog.module.css';

export function CatalogPage() {
  const { t } = useTranslation('common');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listProducts()
      .then(setProducts)
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return (
    <section className={styles.section}>
      <p className={styles.moduleLabel}>catalog</p>
      <h1 className={styles.heading}>{t('catalog.heading')}</h1>

      {loading && (
        <div className={styles.grid} aria-busy="true" aria-label="Loading products">
          {[1, 2, 3].map((n) => (
            <div key={n} className={`${styles.card} ${styles.skeleton}`} aria-hidden="true" />
          ))}
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}

      {!loading && !error && (
        <ul className={styles.grid} role="list">
          {products.map((p) => (
            <li key={p.sku}>
              <ProductCard product={p} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
