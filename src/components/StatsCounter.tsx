import React, { useState, useEffect, useRef } from 'react';
import { Users, Coins, MapPin, School, HeartPulse, Award } from 'lucide-react';
import { StatItem } from '../types';
import { useLanguage } from '../context/LanguageContext';

interface StatsCounterProps {
  stats: StatItem[];
}

const iconMap: Record<string, React.ReactNode> = {
  Users: <Users className="w-8 h-8 text-amber-400" />,
  Coins: <Coins className="w-8 h-8 text-amber-400" />,
  MapPin: <MapPin className="w-8 h-8 text-amber-400" />,
  School: <School className="w-8 h-8 text-amber-400" />,
  HeartPulse: <HeartPulse className="w-8 h-8 text-amber-400" />,
  Award: <Award className="w-8 h-8 text-amber-400" />,
};

export const StatsCounter: React.FC<StatsCounterProps> = ({ stats }) => {
  const { lang } = useLanguage();
  const [counts, setCounts] = useState<number[]>(stats.map(() => 0));
  const [hasAnimated, setHasAnimated] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          stats.forEach((stat, idx) => {
            let start = 0;
            const end = stat.value;
            const duration = 2000;
            const increment = Math.ceil(end / (duration / 30));

            const timer = setInterval(() => {
              start += increment;
              if (start >= end) {
                start = end;
                clearInterval(timer);
              }
              setCounts((prev) => {
                const next = [...prev];
                next[idx] = start;
                return next;
              });
            }, 30);
          });
        }
      },
      { threshold: 0.2 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [stats, hasAnimated]);

  const locale = lang === 'en' ? 'en-US' : 'bn-BD';

  return (
    <section
      ref={containerRef}
      className="bg-[color:var(--site-primary)] text-white py-14 px-6 sm:px-12 relative overflow-hidden border-y border-[color:var(--site-primary)]/20"
    >
      <div className="absolute top-0 right-0 opacity-10 pointer-events-none">
        <svg width="240" height="120" viewBox="0 0 200 100">
          <circle cx="150" cy="50" r="80" fill="none" stroke="white" strokeWidth="1" strokeDasharray="4 4" />
        </svg>
      </div>

      <div className="container relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 items-center">
          {stats.map((stat, idx) => (
            <div key={stat.id || idx} className="text-center relative px-2 py-4">
              <div className="serif text-3xl sm:text-4xl lg:text-5xl text-white font-bold tracking-tight">
                {counts[idx]?.toLocaleString(locale) || (0).toLocaleString(locale)}
                <span className="text-[color:var(--site-accent)] font-serif font-bold ml-1">{stat.suffix || '+'}</span>
              </div>
              <div className="sans text-[10px] sm:text-xs uppercase tracking-widest text-white/60 mt-1 font-semibold">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
