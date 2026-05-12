import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, apiError } from '@/lib/api';
import ProductCard, { ProductCardSkeleton } from '@/components/ProductCard';
import ItemDetailModal from '@/components/ItemDetailModal';
import { Search } from 'lucide-react';

export default function Menu() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCat = searchParams.get('category') || 'all';

  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [activeCat, setActiveCat] = useState(initialCat);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalItem, setModalItem] = useState(null);

  useEffect(() => {
    api.get('/menu/categories').then(({ data }) => setCategories(data || [])).catch((e) => console.error(apiError(e)));
  }, []);

  useEffect(() => {
    setLoading(true);
    const url = activeCat && activeCat !== 'all'
      ? `/menu/items?category_id=${activeCat}` : '/menu/items';
    api.get(url)
      .then(({ data }) => setItems(data || []))
      .catch((e) => console.error(apiError(e)))
      .finally(() => setLoading(false));

    if (activeCat === 'all') {
      searchParams.delete('category');
    } else {
      searchParams.set('category', activeCat);
    }
    setSearchParams(searchParams, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCat]);

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter((i) =>
      (i.name_en || '').toLowerCase().includes(q)
      || (i.description_en || '').toLowerCase().includes(q),
    );
  }, [items, search]);

  return (
    <div className="container-lamazi py-10" data-testid="menu-page">
      <div className="text-center mb-8">
        <p className="font-script text-3xl text-lamazi-secondary-deep -mb-1">Browse</p>
        <h1 className="font-display text-4xl sm:text-5xl font-bold text-lamazi-primary">Our Menu</h1>
        <p className="section-subtitle mt-3">Every cake hand-crafted, every flavour rooted in tradition.</p>
      </div>

      {/* search */}
      <div className="max-w-md mx-auto mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-lamazi-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search cakes, pastries…"
            className="w-full pl-11 pr-4 py-3 rounded-full bg-white border border-lamazi-secondary/60 focus:outline-none focus:border-lamazi-primary text-sm"
            data-testid="menu-search-input"
          />
        </div>
      </div>

      {/* tabs */}
      <div className="flex gap-2 sm:gap-3 overflow-x-auto no-scrollbar pb-2 mb-8 justify-start sm:justify-center">
        <button
          onClick={() => setActiveCat('all')}
          className={`shrink-0 px-5 py-2 rounded-full text-sm font-medium transition-colors ${
            activeCat === 'all'
              ? 'bg-lamazi-primary text-lamazi-neutral'
              : 'bg-white text-lamazi-primary border border-lamazi-secondary/60 hover:border-lamazi-primary'
          }`}
          data-testid="menu-tab-all"
        >All</button>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveCat(c.id)}
            className={`shrink-0 px-5 py-2 rounded-full text-sm font-medium transition-colors ${
              activeCat === c.id
                ? 'bg-lamazi-primary text-lamazi-neutral'
                : 'bg-white text-lamazi-primary border border-lamazi-secondary/60 hover:border-lamazi-primary'
            }`}
            data-testid={`menu-tab-${c.id}`}
          >{c.name_en}</button>
        ))}
      </div>

      {/* grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
        {loading ? Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)
          : filtered.length === 0 ? (
            <div className="col-span-full text-center py-16 text-lamazi-muted">
              No items found. Try a different category or search term.
            </div>
          ) : filtered.map((it) => (
            <ProductCard key={it.id} item={it} onAdd={() => setModalItem(it.id)} />
          ))}
      </div>

      <ItemDetailModal open={Boolean(modalItem)} itemId={modalItem} onClose={() => setModalItem(null)} />
    </div>
  );
}
