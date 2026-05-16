import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, apiError } from '@/lib/api';
import ProductCard, { ProductCardSkeleton } from '@/components/ProductCard';
import ItemDetailModal from '@/components/ItemDetailModal';
import { useLang } from '@/contexts/LangContext';
import { ChevronRight, Sparkles, Heart, Award, Play } from 'lucide-react';

// TODO: Replace with real YouTube video IDs if you want different videos.
const VIDEOS = {
  main: '2heBxQ-RJhM',
  secondary1: 'Cvuh7NkCggI',
  secondary2: '2heBxQ-RJhM',
};

const HERO_IMAGE = 'https://i.pinimg.com/originals/48/b9/13/48b913ee1e3f11a466aa17d4287efe0c.jpg';

export default function Home() {
  const navigate = useNavigate();
  const { L } = useLang();
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalItem, setModalItem] = useState(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get('/menu/categories'),
      api.get('/menu/items?limit=4'),
    ])
      .then(([c, i]) => {
        setCategories(c.data || []);
        setItems((i.data || []).slice(0, 4));
      })
      .catch((e) => console.error(apiError(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-16 sm:space-y-24 pb-12">
      {/* Hero Banner */}
      <section className="relative pt-3" data-testid="home-hero">
        <div className="container-lamazi">
          <div className="relative rounded-3xl overflow-hidden shadow-[0_20px_60px_-20px_rgba(88,0,14,0.45)]">
            <img src={HERO_IMAGE} alt="Lamazi signature cakes" className="w-full h-[300px] sm:h-[420px] md:h-[480px] object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-lamazi-primary/85 via-lamazi-primary/50 to-transparent" />
            <div className="absolute inset-0 flex items-center">
              <div className="container-lamazi">
                <div className="max-w-xl text-lamazi-neutral animate-fade-up">
                  <p className="font-script text-3xl sm:text-5xl text-lamazi-secondary mb-2">Signature</p>
                  <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-bold leading-[1.05]">
                    All Cakes<br />Up To <span className="text-lamazi-secondary">KWD 15</span>
                  </h1>
                  <p className="mt-4 sm:mt-5 text-sm sm:text-base text-lamazi-neutral/90 max-w-md">
                    Discover handcrafted desserts made fresh every morning in Hawally. Premium ingredients, timeless recipes.
                  </p>
                  <button onClick={() => navigate('/menu')} className="btn-gold mt-6" data-testid="hero-explore-btn">
                    Explore Collection <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
              <span className="w-6 h-1 bg-lamazi-secondary rounded-full" />
              <span className="w-1.5 h-1 bg-lamazi-neutral/40 rounded-full" />
              <span className="w-1.5 h-1 bg-lamazi-neutral/40 rounded-full" />
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="container-lamazi" data-testid="home-categories">
        <div className="flex items-end justify-between mb-6">
          <div>
            <p className="font-script text-2xl text-lamazi-secondary-deep -mb-1">Browse</p>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-lamazi-primary">Categories</h2>
          </div>
          <Link to="/menu" className="text-sm text-lamazi-primary hover:underline hidden sm:inline">View all →</Link>
        </div>
        <div className="flex gap-4 sm:gap-6 overflow-x-auto no-scrollbar pb-2">
          {(loading ? Array.from({ length: 4 }) : categories).map((c, i) => (
            c ? (
              <button
                key={c.id}
                onClick={() => navigate(`/menu?category=${c.id}`)}
                className="group shrink-0 w-[140px] sm:w-[170px] rounded-2xl bg-white border border-lamazi-secondary/40 overflow-hidden shadow-sm hover:shadow-md transition-all"
                data-testid={`category-${c.id}`}
              >
                <div className="aspect-square bg-lamazi-secondary/30 overflow-hidden">
                  {c.image_url ? (
                    <img src={c.image_url} alt={L(c, 'name')} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full" />
                  )}
                </div>
                <p className="py-3 text-center text-sm font-semibold text-lamazi-primary">{L(c, 'name')}</p>
              </button>
            ) : (
              <div key={i} className="shrink-0 w-[140px] sm:w-[170px] rounded-2xl bg-lamazi-secondary/20 animate-pulse">
                <div className="aspect-square" />
                <div className="h-10" />
              </div>
            )
          ))}
        </div>
      </section>

      {/* Featured */}
      <section className="container-lamazi" data-testid="home-featured">
        <div className="text-center mb-10">
          <p className="font-script text-3xl text-lamazi-secondary-deep -mb-1">Bestsellers</p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-lamazi-primary">Featured Cakes</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
          {(loading ? Array.from({ length: 4 }) : items).map((it, i) => (
            it ? <ProductCard key={it.id} item={it} onAdd={() => setModalItem(it.id)} />
              : <ProductCardSkeleton key={i} />
          ))}
        </div>
        <div className="text-center mt-10">
          <Link to="/menu" className="btn-primary" data-testid="home-view-menu-btn">
            View Full Menu <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Watch and Try */}
      <section className="container-lamazi" data-testid="home-videos">
        <div className="text-center mb-8">
          <p className="font-script text-3xl text-lamazi-secondary-deep -mb-1">Behind the bake</p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-lamazi-primary">Watch and Try</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 aspect-video rounded-2xl overflow-hidden bg-black/5 relative group">
            <iframe
              className="w-full h-full"
              src={`https://www.youtube.com/embed/${VIDEOS.main}`}
              title="Watch and Try"
              allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
          <div className="grid grid-rows-2 gap-4">
            <div className="aspect-video rounded-2xl overflow-hidden bg-black/5">
              <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${VIDEOS.secondary1}`} allowFullScreen />
            </div>
            <div className="aspect-video rounded-2xl overflow-hidden bg-black/5">
              <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${VIDEOS.secondary2}`} allowFullScreen />
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="container-lamazi" data-testid="home-why">
        <div className="text-center mb-10">
          <p className="font-script text-3xl text-lamazi-secondary-deep -mb-1">The Lamazi Promise</p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-lamazi-primary">Why Choose Us</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { icon: Sparkles, title: 'Freshly baked', desc: 'Every cake is made the same morning we deliver it. Nothing freezes, nothing sits.' },
            { icon: Heart, title: 'Family recipes', desc: 'Generations of know-how in every layer. From the Lamazi kitchen to your table.' },
            { icon: Award, title: 'Premium only', desc: 'Real butter, Belgian chocolate, fresh fruit. We don\'t cut corners — only cakes.' },
          ].map((c) => (
            <div key={c.title} className="cream-card text-center">
              <div className="w-14 h-14 rounded-full bg-lamazi-primary text-lamazi-secondary flex items-center justify-center mx-auto mb-4">
                <c.icon className="w-6 h-6" />
              </div>
              <h3 className="font-display text-xl text-lamazi-primary font-semibold mb-2">{c.title}</h3>
              <p className="text-sm text-lamazi-muted leading-relaxed">{c.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Loyalty banner */}
      <section className="container-lamazi" data-testid="home-loyalty-banner">
        <div className="rounded-3xl bg-gradient-to-br from-lamazi-tertiary to-lamazi-primary text-lamazi-neutral p-8 sm:p-12 flex flex-col sm:flex-row items-center gap-6">
          <div className="flex-1">
            <p className="font-script text-3xl text-lamazi-secondary -mb-1">Sweet rewards</p>
            <h3 className="font-display text-2xl sm:text-3xl font-bold">Join the <span className="brand-wordmark-light text-2xl sm:text-3xl">LAMAZI</span> Club & earn points on every order</h3>
            <p className="text-sm text-lamazi-neutral/80 mt-2 max-w-lg">
              Every dinar spent earns you points to redeem on future cakes. Free to join, sweetly generous.
            </p>
          </div>
          <Link to="/auth" className="btn-gold whitespace-nowrap" data-testid="loyalty-banner-join-btn">
            Join Now <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <ItemDetailModal open={Boolean(modalItem)} itemId={modalItem} onClose={() => setModalItem(null)} />
    </div>
  );
}
