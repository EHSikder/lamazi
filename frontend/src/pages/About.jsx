import React from 'react';
import { Heart, Leaf, Sparkles } from 'lucide-react';

// TODO: Replace with real YouTube Shorts IDs if you want different videos.
const SHORTS = ['kocNGCZ1aaA', 'JeOE9XrjA9k', 'tN6MNnqD-Jk', 'kocNGCZ1aaA'];

const STORY_IMG_1 = 'https://i.pinimg.com/1200x/e5/3b/d9/e53bd90ed872b4701612019613b07f4e.jpg';
const STORY_IMG_2 = 'https://i.pinimg.com/1200x/94/1d/a4/941da4802d575f226fb4ad9415c1dd94.jpg';

export default function About() {
  return (
    <div className="container-lamazi py-12 space-y-20" data-testid="about-page">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto">
        <p className="font-script text-3xl text-lamazi-secondary-deep -mb-1">Our story</p>
        <h1 className="font-display text-4xl sm:text-5xl font-bold text-lamazi-primary">About LAMAZI</h1>
        <p className="section-subtitle mt-4">
          A Kuwaiti family bakery devoted to the craft of fine cakes and Arabic sweets. We measure
          everything by one thing — the smile that comes after the first bite.
        </p>
      </div>

      {/* Our Story */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center" data-testid="about-story">
        <div className="grid grid-cols-2 gap-4">
          <img src={STORY_IMG_1} alt="Cake detail" className="rounded-2xl h-64 sm:h-80 w-full object-cover shadow-md" />
          <img src={STORY_IMG_2} alt="Pastry detail" className="rounded-2xl h-64 sm:h-80 w-full object-cover shadow-md mt-8" />
        </div>
        <div className="space-y-4">
          <p className="font-script text-2xl text-lamazi-secondary-deep -mb-2">A passion for sweet</p>
          <h2 className="font-display text-3xl font-bold text-lamazi-primary">Crafted with care, since day one</h2>
          <p className="text-lamazi-muted leading-relaxed">
            What began as a small family kitchen in Hawally has grown into Kuwait's most-loved
            cake destination. We still bake the way our grandmothers taught us — slowly,
            patiently, and with the best ingredients we can find. Every Lamazi cake is a piece of
            our story.
          </p>
          <p className="text-lamazi-muted leading-relaxed">
            From silky chocolate ganache to a perfectly golden cheesecake crust, our bakers take
            pride in the details. We don't chase trends. We chase taste.
          </p>
        </div>
      </section>

      {/* Our Values */}
      <section data-testid="about-values">
        <div className="text-center mb-10">
          <p className="font-script text-3xl text-lamazi-secondary-deep -mb-1">What guides us</p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-lamazi-primary">Our Values</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { icon: Leaf, title: 'Pure ingredients', desc: 'Real butter, fresh cream, premium chocolate. No shortcuts, ever.' },
            { icon: Heart, title: 'Made by hand', desc: 'Every layer, every swirl, every garnish — placed by a baker, not a machine.' },
            { icon: Sparkles, title: 'Bake fresh, deliver fresh', desc: 'We bake the same morning you order. Your cake hasn\'t seen a freezer.' },
          ].map((v) => (
            <div key={v.title} className="cream-card">
              <div className="w-14 h-14 rounded-full bg-lamazi-primary text-lamazi-secondary flex items-center justify-center mb-4">
                <v.icon className="w-6 h-6" />
              </div>
              <h3 className="font-display text-xl text-lamazi-primary font-semibold mb-2">{v.title}</h3>
              <p className="text-sm text-lamazi-muted leading-relaxed">{v.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* From Our Kitchen */}
      <section data-testid="about-kitchen">
        <div className="text-center mb-8">
          <p className="font-script text-3xl text-lamazi-secondary-deep -mb-1">A peek inside</p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-lamazi-primary">From Our Kitchen</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {SHORTS.map((id, i) => (
            <div key={`${id}-${i}`} className="aspect-[9/16] rounded-2xl overflow-hidden bg-black/5 shadow-md">
              <iframe
                className="w-full h-full"
                src={`https://www.youtube.com/embed/${id}`}
                title={`Lamazi short ${i + 1}`}
                allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
