import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, ArrowRight, Pause, Play, ChevronDown } from 'lucide-react';
import { HeroSlide } from '../types';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';

interface HeroSliderProps {
  slides: HeroSlide[];
}

export const HeroSlider: React.FC<HeroSliderProps> = ({ slides }) => {
  const { lang } = useLanguage();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const activeSlides = slides.filter((s) => s.isActive).sort((a, b) => a.order - b.order);

  useEffect(() => {
    if (activeSlides.length === 0) return;

    if (!isPaused) {
      timerRef.current = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % activeSlides.length);
      }, 4500);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeSlides.length, isPaused]);

  if (activeSlides.length === 0) {
    return (
      <div className="w-full h-screen bg-emerald-950 flex items-center justify-center text-white font-serif">
        <p>স্লাইড পাওয়া যায়নি</p>
      </div>
    );
  }

  const currentSlide = activeSlides[currentIndex] || activeSlides[0];

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + activeSlides.length) % activeSlides.length);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % activeSlides.length);
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current;
    const touch = event.changedTouches[0];
    touchStartRef.current = null;

    if (!start || !touch) return;

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;

    if (Math.abs(deltaX) < 45 || Math.abs(deltaX) < Math.abs(deltaY)) return;

    if (deltaX > 0) {
      handlePrev();
    } else {
      handleNext();
    }
  };

  const scrollToNextSection = () => {
    window.scrollTo({
      top: window.innerHeight - 80,
      behavior: 'smooth',
    });
  };

  return (
    <div
      className="relative w-full h-[75vh] min-h-[560px] overflow-hidden bg-slate-950 select-none lg:h-screen lg:min-h-[600px]"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Background Slides with Ken Burns Crossfade Animation */}
      {activeSlides.map((slide, idx) => {
        const isActive = idx === currentIndex;
        return (
          <div
            key={slide.id}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
              isActive ? 'opacity-100 z-10' : 'opacity-0 z-0'
            }`}
          >
            {/* Image with Ken-Burns scale effect */}
            <div
              className={`w-full h-full bg-cover bg-center transition-transform duration-[6000ms] ease-out ${
                isActive ? 'scale-110' : 'scale-100'
              }`}
              style={{ backgroundImage: `url(${slide.image})` }}
            />

            {/* Dark Gradient Overlay for Maximum Readability */}
            <div className="absolute inset-0 bg-black/45 lg:hidden" />
            <div className="absolute inset-0 hidden lg:block gradient-overlay" />
            <div className="absolute inset-0 hidden lg:block bg-gradient-to-r from-[#1B3022]/90 via-transparent to-transparent" />
          </div>
        );
      })}

      {/* Slide Content Overlay */}
      <div className="relative z-20 container h-full flex flex-col justify-center px-6 pt-24 pb-24 lg:justify-end lg:px-6 lg:pb-24 lg:pt-20">
        <div className="max-w-3xl space-y-5 lg:space-y-6 animate-fadeIn">
          {/* Top Tag */}
          <span className="block max-w-full text-[#B38B4D] text-xs font-bold uppercase tracking-[0.16em] sm:tracking-[0.22em] lg:tracking-[0.3em] leading-relaxed break-words">
            {lang === 'en'
              ? 'Village Development Organization Bogura (GUSB) - Social Advancement'
              : 'গ্রাম উন্নয়ন সংস্থা বগুড়া (GUSB) - সামাজিক অগ্রযাত্রা'}
          </span>

          {/* Main Headline */}
          <h1 className="max-w-full text-[32px] lg:text-5xl xl:text-6xl font-serif font-bold text-white tracking-tight leading-[1.1] break-words">
            {currentSlide.headline}
          </h1>

          {/* Subtext */}
          <p className="max-w-2xl text-base text-[#F8F5F0]/90 font-sans font-normal leading-relaxed break-words">
            {currentSlide.subtext}
          </p>

          {/* Call to Action Buttons */}
          <div className="pt-2 flex flex-col lg:flex-row lg:flex-wrap items-stretch lg:items-center gap-4">
            <Link
              to={currentSlide.buttonLink || '/programs'}
              className="inline-flex h-12 w-full lg:w-auto items-center justify-center lg:justify-start gap-2.5 bg-[#B38B4D] hover:bg-[#a17a3b] text-white px-8 py-4 rounded-sm text-xs uppercase tracking-widest font-bold transition-all shadow-xl"
            >
              <span>
                {lang === 'en' ? 'View Our Activities' : (currentSlide.buttonText || 'আমাদের কার্যক্রম দেখুন')}
              </span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              to="/about"
              className="inline-flex h-12 w-full lg:w-auto items-center justify-center lg:justify-start gap-2 px-7 py-4 rounded-sm border border-white/40 hover:bg-white/10 text-white font-bold text-xs uppercase tracking-widest transition-all"
            >
              {lang === 'en' ? 'Our Story' : 'আমাদের গল্প'}
            </Link>
          </div>
        </div>
      </div>

      {/* Manual Prev / Next Navigation Arrows */}
      <div className="absolute left-0 right-0 bottom-6 z-30 container flex items-center justify-between gap-3 lg:left-auto lg:right-12 lg:bottom-12 lg:w-auto lg:px-0">
        <div className="flex gap-2">
          {activeSlides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`w-2 h-2 rounded-full transition-all ${
                idx === currentIndex ? 'bg-[#B38B4D] w-6' : 'bg-white/40'
              }`}
            />
          ))}
        </div>
        <div className="hidden sm:block h-8 w-[1px] bg-white/20 mx-1"></div>
        <div className="flex gap-2 sm:gap-3">
          <button
            onClick={handlePrev}
            className="w-11 h-11 lg:w-10 lg:h-10 border border-white/30 rounded-full flex items-center justify-center text-white hover:bg-[#B38B4D] hover:border-[#B38B4D] transition-all"
            aria-label="Previous Slide"
          >
            <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <button
            onClick={handleNext}
            className="w-11 h-11 lg:w-10 lg:h-10 border border-white/30 rounded-full flex items-center justify-center text-white hover:bg-[#B38B4D] hover:border-[#B38B4D] transition-all"
            aria-label="Next Slide"
          >
            <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>

      {/* Animated Scroll Indicator */}
      <button
        onClick={scrollToNextSection}
        className="hidden lg:flex absolute bottom-6 left-4 sm:left-8 lg:left-12 z-30 text-[#B38B4D] hover:text-white items-center gap-2 transition-all cursor-pointer text-[11px] uppercase tracking-widest font-bold"
      >
        <span>{lang === 'en' ? 'Scroll Down' : 'নিচে দেখুন'}</span>
        <ChevronDown className="w-4 h-4 animate-bounce" />
      </button>
    </div>
  );
};
