import React, { useState } from 'react';
import { MapPin, Phone, Mail, Clock, Navigation, Building2 } from 'lucide-react';
import { SiteSettings } from '../types';
import { useLanguage } from '../context/LanguageContext';

interface MapWidgetProps {
  settings: SiteSettings;
}

export const MapWidget: React.FC<MapWidgetProps> = ({ settings }) => {
  const { lang } = useLanguage();
  const [selectedOffice, setSelectedOffice] = useState<number>(0);

  /** Build a Google Maps embed URL from coordinates, falling back to the address. */
  const buildMapUrl = (address?: string, lat?: number, lng?: number) => {
    const query = lat && lng ? `${lat},${lng}` : (address || '').trim();
    if (!query) return '';
    return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
  };

  const headOfficeAddress = lang === 'en' ? settings.addressEn || settings.address : settings.address;

  const offices = [
    {
      title: lang === 'en' ? 'Head Office' : 'প্রধান কার্যালয়',
      address: headOfficeAddress,
      phone: settings.phone,
      email: settings.email,
      lat: settings.mapLat,
      lng: settings.mapLng,
      mapUrl: buildMapUrl(headOfficeAddress, settings.mapLat, settings.mapLng),
    },
    ...(settings.branchAddresses || []).map((branch) => ({
      title: branch.name,
      address: branch.address,
      phone: branch.phone,
      email: branch.email,
      lat: undefined as number | undefined,
      lng: undefined as number | undefined,
      mapUrl: buildMapUrl(branch.address),
    })),
  ];

  const currentOffice = offices[selectedOffice] || offices[0];

  return (
    <div className="relative w-full border border-[color:var(--site-accent)]/30 shadow-2xl bg-[color:var(--site-primary)] text-white my-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[500px]">
        {/* Left Side: Office Info Cards */}
        <div className="lg:col-span-5 p-6 lg:p-8 bg-[color:var(--site-primary)] flex flex-col justify-between space-y-6 z-10 border-b lg:border-b-0 lg:border-r border-[color:var(--site-accent)]/30">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[color:var(--site-accent)]/20 text-[color:var(--site-accent)] border border-[color:var(--site-accent)]/30 text-xs font-semibold mb-3">
              <Building2 className="w-3.5 h-3.5" />
              {lang === 'en' ? 'Office & Field Network' : 'অফিস ও ফিল্ড নেটওয়ার্ক'}
            </div>
            <h3 className="text-2xl lg:text-3xl font-serif font-bold text-white mb-4">
              {lang === 'en' ? 'Get In Touch With Us' : 'আমাদের সাথে সরাসরি যোগাযোগ'}
            </h3>

            {/* Office Switcher Tabs */}
            <div className="flex flex-wrap gap-2 mb-6">
              {offices.map((off, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedOffice(idx)}
                  className={`px-3 py-1.5 text-xs font-semibold transition-all ${
                    selectedOffice === idx
                      ? 'bg-[color:var(--site-accent)] text-[color:var(--site-primary)] shadow-lg scale-105 font-bold'
                      : 'bg-[color:var(--site-primary)] border border-[color:var(--site-accent)]/30 text-[#F8F5F0]/80 hover:bg-[color:var(--site-accent)]/20'
                  }`}
                >
                  {off.title}
                </button>
              ))}
            </div>

            {/* Selected Office Details */}
            <div className="bg-[color:var(--site-primary)]/90 p-5 border border-[color:var(--site-accent)]/40 space-y-3 text-sm text-[#F8F5F0]/90 shadow-xl">
              <h4 className="text-lg font-serif font-bold text-[color:var(--site-accent)] border-b border-[color:var(--site-accent)]/30 pb-2">
                {currentOffice.title}
              </h4>

              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-[color:var(--site-accent)] shrink-0 mt-0.5" />
                <span>{currentOffice.address}</span>
              </div>

              <div className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-[color:var(--site-accent)] shrink-0" />
                <a
                  href={`tel:${currentOffice.phone.split(',')[0].trim()}`}
                  className="hover:text-[color:var(--site-accent)] font-semibold"
                >
                  {currentOffice.phone}
                </a>
              </div>

              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-[color:var(--site-accent)] shrink-0" />
                <a
                  href={`mailto:${currentOffice.email}`}
                  className="hover:text-[color:var(--site-accent)] font-semibold"
                >
                  {currentOffice.email}
                </a>
              </div>

              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-[color:var(--site-accent)] shrink-0 mt-0.5" />
                <span>{settings.officeHours}</span>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(currentOffice.address)}`}
              target="_blank"
              rel="noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-[color:var(--site-accent)] hover:bg-[color:var(--site-accent-dark)] text-[color:var(--site-primary)] font-bold text-xs uppercase tracking-wider shadow-lg transition-all"
            >
              <Navigation className="w-4 h-4" />
              {lang === 'en' ? 'View Google Maps Route' : 'গুগল ম্যাপে রুট ম্যাপ দেখুন'}
            </a>
          </div>
        </div>

        {/* Right Side: Interactive Embedded Map */}
        <div className="lg:col-span-7 relative h-[350px] lg:h-auto w-full bg-slate-900">
          {!currentOffice.mapUrl ? (
            <div className="w-full h-full flex items-center justify-center text-center text-xs text-white/60 px-6">
              {lang === 'en'
                ? 'Add the office address or map coordinates in the admin panel to display the map.'
                : 'ম্যাপ দেখাতে অ্যাডমিন প্যানেল থেকে অফিসের ঠিকানা বা ম্যাপ কো-অর্ডিনেট যোগ করুন।'}
            </div>
          ) : (
          <iframe
            title="NGO Office Map"
            src={currentOffice.mapUrl}
            width="100%"
            height="100%"
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="w-full h-full filter contrast-125 opacity-90"
          />
          )}
        </div>
      </div>
    </div>
  );
};
