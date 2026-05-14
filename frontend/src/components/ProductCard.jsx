import React from 'react';
import { fmtKWD } from '@/lib/utils-app';
import { useLang } from '@/contexts/LangContext';

export default function ProductCard({ item, onAdd, badge }) {
  const { L } = useLang();
  const name = L(item, 'name');
  const desc = L(item, 'description');
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onAdd?.(item)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAdd?.(item); } }}
      className="product-card cursor-pointer focus:outline-none focus:ring-2 focus:ring-lamazi-primary focus:ring-offset-2"
      data-testid={`product-card-${item.id}`}
    >
      <div className="aspect-square w-full overflow-hidden bg-lamazi-secondary/30 relative">
        {item.image_url ? (
          <img src={item.image_url} alt={name} className="w-full h-full object-cover transition-transform duration-500 hover:scale-105" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-lamazi-muted text-sm">No image</div>
        )}
        {badge && (
          <span className="absolute top-3 left-3 bg-lamazi-primary text-lamazi-neutral text-[10px] uppercase tracking-widest font-semibold px-3 py-1 rounded-full">
            {badge}
          </span>
        )}
      </div>
      <div className="p-4 sm:p-5 flex flex-col flex-1 gap-2">
        <div className="flex items-start justify-between gap-3">
          <h4 className="font-display font-bold text-lamazi-primary text-lg leading-tight truncate flex-1">
            {name}
          </h4>
          <span className="text-sm font-semibold text-lamazi-primary shrink-0">{fmtKWD(item.base_price)}</span>
        </div>
        <p className="text-xs text-lamazi-muted truncate-2 min-h-[2.5rem] leading-relaxed">
          {desc || ' '}
        </p>
        <button
          onClick={(e) => { e.stopPropagation(); onAdd?.(item); }}
          className="btn-primary mt-2 w-full py-2.5 text-sm"
          data-testid={`add-to-bag-${item.id}`}
        >
          Add to Bag
        </button>
      </div>
    </div>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="product-card animate-pulse">
      <div className="aspect-square w-full bg-lamazi-secondary/30" />
      <div className="p-4 space-y-2">
        <div className="h-5 bg-lamazi-secondary/40 rounded w-3/4" />
        <div className="h-3 bg-lamazi-secondary/30 rounded w-full" />
        <div className="h-3 bg-lamazi-secondary/30 rounded w-1/2" />
        <div className="h-10 bg-lamazi-secondary/40 rounded-full mt-3" />
      </div>
    </div>
  );
}
