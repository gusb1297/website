import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Eye, ArrowRight, Tag } from 'lucide-react';
import { NewsItem } from '../types';
import { useLanguage } from '../context/LanguageContext';

interface NewsCardProps {
  news: NewsItem;
}

export const NewsCard: React.FC<NewsCardProps> = ({ news }) => {
  const { lang, t } = useLanguage();
  const formattedDate = new Date(news.publishedAt).toLocaleDateString(lang === 'en' ? 'en-US' : 'bn-BD', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <article className="bg-white rounded-2xl overflow-hidden border border-[color:var(--site-primary)]/10 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between h-full group hover:-translate-y-1">
      {/* Thumbnail */}
      <div className="relative h-48 overflow-hidden bg-[color:var(--site-primary)]">
        <img
          src={news.thumbnail}
          alt={news.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90"
        />
        <div className="absolute top-3 left-3">
          <span className="inline-flex items-center gap-1 px-3 py-1 text-[10px] font-bold uppercase tracking-widest bg-[color:var(--site-primary)]/90 text-[color:var(--site-accent)] border border-[color:var(--site-accent)]/30">
            <Tag className="w-3 h-3 text-[color:var(--site-accent)]" />
            {news.category}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div className="space-y-2.5">
          <div className="flex items-center gap-4 text-[11px] text-[color:var(--site-primary)]/60 font-sans font-medium">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-[color:var(--site-accent)]" />
              {formattedDate}
            </span>
            <span className="flex items-center gap-1">
              <Eye className="w-3.5 h-3.5 text-[color:var(--site-accent)]" />
              {lang === 'en' ? `${news.views} views` : `${news.views} বার পঠিত`}
            </span>
          </div>

          <h3 className="text-base font-bold font-serif text-[color:var(--site-primary)] group-hover:text-[color:var(--site-accent)] transition-colors line-clamp-2 leading-snug">
            {news.title}
          </h3>

          <p className="text-xs text-[color:var(--site-primary)]/70 font-sans line-clamp-2 leading-relaxed">
            {news.content.replace(/[#*`]/g, '')}
          </p>
        </div>

        <div className="mt-4 pt-3 border-t border-[color:var(--site-primary)]/10">
          <Link
            to={`/news/${news.slug}`}
            className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[color:var(--site-primary)] hover:text-[color:var(--site-accent)] uppercase tracking-widest transition-colors"
          >
            <span>{t('read_more')}</span>
            <ArrowRight className="w-3.5 h-3.5 text-[color:var(--site-accent)] group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>
    </article>
  );
};
