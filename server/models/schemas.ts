import mongoose, { Schema } from 'mongoose';
import {
  HeroSlide,
  Program,
  NewsItem,
  VideoItem,
  Notice,
  Publication,
  GalleryAlbum,
  GalleryPhoto,
  CommitteeMember,
  Partner,
  CareerCircular,
  Application,
  StatItem,
  SiteSettings,
} from '../../src/types';

// Mongoose Schemas
const HeroSlideSchema = new Schema({
  image: { type: String, required: true },
  headline: { type: String, required: true },
  subtext: { type: String, required: true },
  buttonText: String,
  buttonLink: String,
  order: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
});

const ProgramSchema = new Schema({
  title: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  icon: { type: String, required: true },
  shortDesc: { type: String, required: true },
  content: { type: String, required: true },
  coverImage: { type: String, required: true },
  status: { type: String, enum: ['ongoing', 'completed'], default: 'ongoing' },
  order: { type: Number, default: 0 },
  beneficiariesCount: Number,
  districtsCovered: Number,
});

const NewsSchema = new Schema({
  title: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  category: { type: String, enum: ['News', 'Event', 'Press Release', 'Impact Story'], required: true },
  thumbnail: { type: String, required: true },
  content: { type: String, required: true },
  publishedAt: { type: Date, default: Date.now },
  views: { type: Number, default: 0 },
  author: String,
});

const VideoSchema = new Schema({
  title: { type: String, required: true },
  type: { type: String, enum: ['upload', 'embed'], required: true },
  filePath: String,
  thumbnail: { type: String, required: true },
  embedUrl: String,
  duration: String,
  uploadedAt: { type: Date, default: Date.now },
  category: String,
});

const NoticeSchema = new Schema({
  title: { type: String, required: true },
  pdfFile: { type: String, required: true },
  publishedAt: { type: Date, default: Date.now },
  expiryDate: Date,
  isActive: { type: Boolean, default: true },
  referenceNo: String,
});

const PublicationSchema = new Schema({
  title: { type: String, required: true },
  type: { type: String, enum: ['annual_report', 'newsletter', 'report'], required: true },
  pdfFile: { type: String, required: true },
  year: { type: Number, required: true },
  thumbnail: String,
});

const GalleryAlbumSchema = new Schema({
  title: { type: String, required: true },
  coverImage: { type: String, required: true },
  description: String,
  createdAt: { type: Date, default: Date.now },
});

const GalleryPhotoSchema = new Schema({
  albumId: { type: Schema.Types.ObjectId, ref: 'GalleryAlbum', required: true },
  image: { type: String, required: true },
  caption: String,
  uploadedAt: { type: Date, default: Date.now },
});

const CommitteeSchema = new Schema({
  name: { type: String, required: true },
  designation: { type: String, required: true },
  type: { type: String, enum: ['general', 'executive', 'advisory', 'leadership'], required: true },
  photo: { type: String, required: true },
  bio: { type: String, required: true },
  order: { type: Number, default: 0 },
  email: String,
  phone: String,
});

const PartnerSchema = new Schema({
  name: { type: String, required: true },
  logo: { type: String, required: true },
  websiteUrl: String,
});

const CareerSchema = new Schema({
  title: { type: String, required: true },
  deadline: { type: Date, required: true },
  description: { type: String, required: true },
  location: { type: String, required: true },
  vacancy: { type: Number, default: 1 },
  pdfFile: String,
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

const ApplicationSchema = new Schema({
  careerId: { type: Schema.Types.ObjectId, ref: 'Career', required: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  cvFile: { type: String, required: true },
  notes: String,
  submittedAt: { type: Date, default: Date.now },
});

const StatSchema = new Schema({
  label: { type: String, required: true },
  value: { type: Number, required: true },
  suffix: String,
  icon: String,
  order: { type: Number, default: 0 },
});

const AdminSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['admin', 'editor'], default: 'admin' },
});

const SiteSettingsSchema = new Schema({
  ngoName: String,
  ngoTagline: String,
  address: String,
  branchAddresses: Array,
  phone: String,
  emergencyHotline: String,
  email: String,
  officeHours: String,
  mapLat: Number,
  mapLng: Number,
  registrationNumber: String,
  establishedYear: Number,
  socialLinks: Object,
});

export const MHeroSlide = mongoose.models.HeroSlide || mongoose.model('HeroSlide', HeroSlideSchema);
export const MProgram = mongoose.models.Program || mongoose.model('Program', ProgramSchema);
export const MNews = mongoose.models.News || mongoose.model('News', NewsSchema);
export const MVideo = mongoose.models.Video || mongoose.model('Video', VideoSchema);
export const MNotice = mongoose.models.Notice || mongoose.model('Notice', NoticeSchema);
export const MPublication = mongoose.models.Publication || mongoose.model('Publication', PublicationSchema);
export const MGalleryAlbum = mongoose.models.GalleryAlbum || mongoose.model('GalleryAlbum', GalleryAlbumSchema);
export const MGalleryPhoto = mongoose.models.GalleryPhoto || mongoose.model('GalleryPhoto', GalleryPhotoSchema);
export const MCommittee = mongoose.models.Committee || mongoose.model('Committee', CommitteeSchema);
export const MPartner = mongoose.models.Partner || mongoose.model('Partner', PartnerSchema);
export const MCareer = mongoose.models.Career || mongoose.model('Career', CareerSchema);
export const MApplication = mongoose.models.Application || mongoose.model('Application', ApplicationSchema);
export const MStat = mongoose.models.Stat || mongoose.model('Stat', StatSchema);
export const MAdmin = mongoose.models.Admin || mongoose.model('Admin', AdminSchema);
export const MSiteSettings = mongoose.models.SiteSettings || mongoose.model('SiteSettings', SiteSettingsSchema);

// In-Memory Fallback Memory Store Data
export const memoryStore = {
  heroSlides: [] as HeroSlide[],
  programs: [] as Program[],
  news: [] as NewsItem[],
  videos: [] as VideoItem[],
  notices: [] as Notice[],
  publications: [] as Publication[],
  galleryAlbums: [] as GalleryAlbum[],
  galleryPhotos: [] as GalleryPhoto[],
  committee: [] as CommitteeMember[],
  partners: [] as Partner[],
  careers: [] as CareerCircular[],
  applications: [] as Application[],
  stats: [] as StatItem[],
  settings: {} as SiteSettings,
};

export function seedInMemoryStore() {
  memoryStore.heroSlides = [
    {
      id: 'slide-1',
      image: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=1920&q=80',
      headline: 'গ্রাম উন্নয়ন সংস্থা বগুড়া (GUSB) - আত্মনির্ভরশীল গ্রামীণ সমাজ গঠন',
      subtext: 'বগুড়া ও উত্তরবঙ্গের সুবিধাবঞ্চিত মানুষের আত্মকর্মসংস্থান, শিক্ষা ও টেকসই উন্নয়নে নিবেদিত।',
      buttonText: 'আমাদের কার্যক্রম',
      buttonLink: '/programs',
      order: 1,
      isActive: true,
    },
    {
      id: 'slide-2',
      image: 'https://images.unsplash.com/photo-1509099836639-18ba1795216d?auto=format&fit=crop&w=1920&q=80',
      headline: 'ক্ষুদ্রঋণ ও নারী উদ্যোক্তা উন্নয়ন সহায়তা',
      subtext: 'সহজ শর্তে ঋণ ও ক্ষুদ্র কুটির শিল্প প্রশিক্ষণের মাধ্যমে গ্রামীণ নারীদের অর্থনৈতিক সাবলম্বিতা নিশ্চিতকরণ।',
      buttonText: 'ক্ষুদ্রঋণ প্রকল্প',
      buttonLink: '/programs',
      order: 2,
      isActive: true,
    },
    {
      id: 'slide-3',
      image: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=1920&q=80',
      headline: 'গুণগত প্রাথমিক শিক্ষা ও প্রাক-প্রাথমিক শিশুকেন্দ্র',
      subtext: 'প্রান্তিক ও চরাঞ্চলের শিশুদের ঝরে পড়া রোধে বিনামূল্যে বই, দ্বীন শিক্ষা ও ডিজিটাল লার্নিং ব্যবস্থা।',
      buttonText: 'শিক্ষা কার্যক্রম',
      buttonLink: '/programs',
      order: 3,
      isActive: true,
    },
    {
      id: 'slide-4',
      image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1920&q=80',
      headline: 'জলবায়ু সহনশীল পরিবেশবান্ধব কৃষি ও আধুনিক সেচ',
      subtext: 'বগুড়ার কৃষকদের জন্য সৌরবিদ্যুৎ চালিত সেচ পাম্প ও বিষমুক্ত জৈব কৃষি প্রযুক্তির বৈপ্লবিক বিস্তার।',
      buttonText: 'কৃষি প্রযুক্তি',
      buttonLink: '/programs',
      order: 4,
      isActive: true,
    },
    {
      id: 'slide-5',
      image: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1920&q=80',
      headline: 'বিনামূল্যে স্বাস্থ্যসেবা, মা-শিশু যত্ন ও নিরাপদ পানি',
      subtext: 'বিশেষজ্ঞ চিকিৎসকের সমন্বয়ে মোবাইল হেলথ ক্যাম্প ও আর্সেনিকমুক্ত নিরাপদ পানি সরবরাহ ব্যবস্থা।',
      buttonText: 'স্বাস্থ্য সেবা',
      buttonLink: '/programs',
      order: 5,
      isActive: true,
    },
  ];

  memoryStore.programs = [
    {
      id: 'prg-1',
      title: 'ক্ষুদ্রঋণ ও সমন্বিত দারিদ্র বিমোচন প্রকল্প',
      slug: 'microfinance-program',
      icon: 'Coins',
      shortDesc: 'বগুড়া ও পার্শ্ববর্তী জেলার প্রান্তিক নারীদের আত্মকর্মসংস্থান সৃষ্টিতে ঋণ ও আর্থিক সহায়তা।',
      content: 'আমাদের প্রধান লক্ষ্য নারীদের স্বাবলম্বী করা। সঞ্চয় ও ক্ষুদ্রঋণ কর্মসূচির মাধ্যমে ৩০,০০০+ নারী নতুন ব্যবসা শুরু করেছেন।',
      coverImage: 'https://images.unsplash.com/photo-1509099836639-18ba1795216d?auto=format&fit=crop&w=800&q=80',
      status: 'ongoing',
      order: 1,
      beneficiariesCount: 350000,
      districtsCovered: 8,
    },
    {
      id: 'prg-2',
      title: 'আলোর দিশারী শিক্ষা ও অক্ষরজ্ঞান কেন্দ্র',
      slug: 'education-literacy',
      icon: 'GraduationCap',
      shortDesc: 'ঝরে পড়া শিশু ও বয়স্ক নিরক্ষরদের জন্য বিনামূল্যে পাঠদান কার্যক্রম।',
      content: 'বগুড়ার চরাঞ্চলে ৫০টি অনানুষ্ঠানিক প্রাথমিক স্কুল পরিচালিত হচ্ছে যেখানে শিশুরা আধুনিক ও প্রযুক্তিভিত্তিক শিক্ষা গ্রহণ করে।',
      coverImage: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=800&q=80',
      status: 'ongoing',
      order: 2,
      beneficiariesCount: 18000,
      districtsCovered: 5,
    },
    {
      id: 'prg-3',
      title: 'কৃষি আধুনিকীকরণ ও টেকসই সেচ প্রকল্প',
      slug: 'sustainable-agriculture',
      icon: 'Sprout',
      shortDesc: 'কৃষকদের জন্য জৈব সার উৎপাদন, সৌর সেচ পাম্প প্রদান ও সঠিক বাজারজাতকরণ শিক্ষা।',
      content: 'পরিবেশবান্ধব ও উন্নত প্রযুক্তির মাধ্যমে কৃষি ফলন ৫০% বৃদ্ধিতে কৃষকদের সার্বিক দিকনির্দেশনা ও বীজ সহায়তা প্রদান।',
      coverImage: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=800&q=80',
      status: 'ongoing',
      order: 3,
      beneficiariesCount: 25000,
      districtsCovered: 6,
    },
    {
      id: 'prg-4',
      title: 'গ্রামীণ স্বাস্থ্য ও বিশুদ্ধ পানি সরবরাহ',
      slug: 'health-water-sanitation',
      icon: 'HeartPulse',
      shortDesc: 'বিনামূল্যে চিকিৎসা সেবা, স্যানিটেশন রিংস্ল্যাব ও আর্সেনিকমুক্ত গভীর নলকূপ স্থাপন।',
      content: 'মা ও শিশুর পুষ্টি নিশ্চিত করতে স্যাটেলাইট ক্লিনিক স্থাপন ও গভীর নলকূপের মাধ্যমে বিশুদ্ধ পানির নিশ্চয়তা।',
      coverImage: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=800&q=80',
      status: 'ongoing',
      order: 4,
      beneficiariesCount: 60000,
      districtsCovered: 4,
    },
  ];

  memoryStore.news = [
    {
      id: 'news-1',
      title: 'গ্রাম উন্নয়ন সংস্থা বগুড়ার (GUSB) উদ্যোগে ৫০০ প্রবীণ ও দুস্থদের মাঝে বিনামূল্যে চিকিৎসা ও ওষুধ বিতরণ',
      slug: 'gusb-free-medical-camp-bogura',
      category: 'Impact Story',
      thumbnail: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=800&q=80',
      content: 'আজ বগুড়া সদরের শেরপুর রোডে অবস্থিত কার্যালয় প্রাঙ্গণে বিনামূল্যে স্বাস্থ্য ক্যাম্প অনুষ্ঠিত হয়। এতে বিশেষজ্ঞ চিকিৎসকরা সেবা প্রদান করেন।',
      publishedAt: new Date().toISOString(),
      views: 142,
      author: 'সংবাদ জনসংযোগ ইউনিট',
    },
    {
      id: 'news-2',
      title: 'বগুড়ায় ১৫০ জন সফল নারী উদ্যোক্তাদের মাঝে ঋণের চেক হস্তান্তর করল GUSB',
      slug: 'women-entrepreneurship-cheque-distribution',
      category: 'Event',
      thumbnail: 'https://images.unsplash.com/photo-1509099836639-18ba1795216d?auto=format&fit=crop&w=800&q=80',
      content: 'স্বাবলম্বী বাংলাদেশ গড়ার লক্ষ্যে ক্ষুদ্র কুটির শিল্প ও গবাদিপশু পালনের জন্য সহজ শর্তে ঋণ সুবিধা দেওয়া হয়।',
      publishedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      views: 210,
      author: 'ফিল্ড কো-অর্ডিনেটর',
    },
  ];

  memoryStore.videos = [
    {
      id: 'vid-1',
      title: 'গ্রাম উন্নয়ন সংস্থা বগুড়া (GUSB) - চরাঞ্চলে জীবন পরিবর্তনের প্রামাণ্যচিত্র',
      type: 'embed',
      embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
      thumbnail: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=800&q=80',
      duration: '06:45',
      uploadedAt: new Date().toISOString(),
      category: 'Documentary',
    },
  ];

  memoryStore.notices = [
    {
      id: 'not-1',
      title: '২০২৬ সালের বার্ষিক সাধারণ সভা (AGM) ও প্রতিনিধি নির্বাচন সংক্রান্ত নোটিশ',
      pdfFile: '/uploads/pdfs/notice_agm_2026.pdf',
      publishedAt: new Date().toISOString(),
      expiryDate: '2026-12-31',
      isActive: true,
      referenceNo: 'GUSB/AGM/2026/01',
    },
    {
      id: 'not-2',
      title: 'সৌর সেচ প্রকল্প ও গভীর নলকূপ সামগ্রী ক্রয়ের জন্য উন্মুক্ত দরপত্র আহ্বান',
      pdfFile: '/uploads/pdfs/tender_solar_2026.pdf',
      publishedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
      expiryDate: '2026-09-30',
      isActive: true,
      referenceNo: 'GUSB/TENDER/2026/04',
    },
  ];

  memoryStore.publications = [
    {
      id: 'pub-1',
      title: 'গ্রাম উন্নয়ন সংস্থা বগুড়া - বার্ষিক অডিট ও আর্থিক কার্যকারিতা রিপোর্ট ২০২৫',
      type: 'annual_report',
      pdfFile: '/uploads/pdfs/annual_report_2025.pdf',
      year: 2025,
      thumbnail: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=400&q=80',
    },
    {
      id: 'pub-2',
      title: 'ক্ষুদ্রঋণ ও অর্থনৈতিক ক্ষমতায়ন বিষয়ক ইম্প্যাক্ট অ্যাসেসমেন্ট স্টাডি',
      type: 'report',
      pdfFile: '/uploads/pdfs/impact_study_2025.pdf',
      year: 2025,
      thumbnail: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=400&q=80',
    },
  ];

  memoryStore.galleryAlbums = [
    {
      id: 'alb-1',
      title: 'মাঠ পর্যায়ের কার্যক্রম ও সদস্য মিলনমেলা',
      coverImage: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=800&q=80',
      description: 'বগুড়া সদর ও শেরপুর শাখার উপকারভোগীদের অভিজ্ঞতা বিনিময় সেশন।',
      createdAt: new Date().toISOString(),
    },
  ];

  memoryStore.galleryPhotos = [
    {
      id: 'photo-1',
      albumId: 'alb-1',
      image: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=800&q=80',
      caption: 'বিনামূল্যে স্বাস্থ্যসেবা ক্যাম্প ২০২৬',
      uploadedAt: new Date().toISOString(),
    },
  ];

  memoryStore.committee = [
    {
      id: 'com-1',
      name: 'অধ্যাপক মোঃ রফিকুল ইসলাম',
      designation: 'চেয়ারম্যান, পরিচালনা পর্ষদ',
      type: 'executive',
      photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
      bio: 'সাবেক অধ্যাপক ও সমাজসেবক। সামাজিক উন্নয়নে দীর্ঘ ২৫ বছরের অভিজ্ঞতা।',
      order: 1,
      email: 'chairman@vdobogura.org',
      phone: '+880 1711 111111',
    },
    {
      id: 'com-2',
      name: 'মোছাঃ নাজমুন নাহার',
      designation: 'নির্বাহী পরিচালক (Executive Director)',
      type: 'executive',
      photo: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80',
      bio: 'এনজিও ও নারী ক্ষমতায়ন বিশেষজ্ঞ। গ্রাম উন্নয়ন সংস্থা বগুড়ার প্রতিষ্ঠাতা সদস্য।',
      order: 2,
      email: 'ed@vdobogura.org',
      phone: '+880 1711 222222',
    },
  ];

  memoryStore.partners = [
    {
      id: 'part-1',
      name: 'পল্লী কর্ম-সহায়ক ফাউন্ডেশন (PKSF)',
      logo: 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?auto=format&fit=crop&w=200&q=80',
      websiteUrl: 'https://pksf.org.bd',
    },
    {
      id: 'part-2',
      name: 'এনজিও বিষয়ক ব্যুরো, বাংলাদেশ',
      logo: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=200&q=80',
      websiteUrl: 'https://ngoab.gov.bd',
    },
  ];

  memoryStore.careers = [
    {
      id: 'car-1',
      title: 'ফিল্ড অফিসার (ক্ষুদ্রঋণ কর্মসূচি) - ৫০ জন',
      deadline: '2026-08-30',
      description: 'বগুড়া ও শাখা কার্যালয়সমূহে মাঠপর্যায়ে দল গঠন, সঞ্চয় আদায় ও ঋণ বিতরণ মনিটরিং।',
      location: 'বগুড়া সদর, শেরপুর, শিবগঞ্জ শাখা',
      vacancy: 50,
      isActive: true,
      createdAt: new Date().toISOString(),
    },
  ];

  memoryStore.applications = [];

  memoryStore.stats = [
    { id: 'st-1', label: 'সুবিধাভোগী পরিবার', value: 350000, suffix: '+', icon: 'Users', order: 1 },
    { id: 'st-2', label: 'কার্যক্রম বিস্তৃত জেলা', value: 8, suffix: ' টি', icon: 'MapPin', order: 2 },
    { id: 'st-3', label: 'মাঠ পর্যায়ের কেন্দ্র', value: 120, suffix: '+', icon: 'Building', order: 3 },
    { id: 'st-4', label: 'সফল নারী উদ্যোক্তা', value: 45000, suffix: '+', icon: 'Award', order: 4 },
  ];

  memoryStore.settings = {
    ngoName: 'গ্রাম উন্নয়ন সংস্থা বগুড়া (Village Development Organization Bogura)',
    ngoTagline: 'টেকসই বিকাশ ও স্বাবলম্বী গ্রামীণ সমাজ গঠনের অঙ্গীকার',
    logoUrl: 'https://i.ibb.co.com/G4ygxGcZ/NGO.png',
    address: 'গ্রাম উন্নয়ন সংস্থা বগুড়া, নওয়াববাড়ী রোড, বগুড়া সদর, বগুড়া-৫৮০০, বাংলাদেশ',
    branchAddresses: [
      {
        name: 'শেরপুর শাখা',
        address: 'বাসস্ট্যান্ড রোড, শেরপুর, বগুড়া',
        phone: '+880 1711 000000',
        email: 'sherpur@vdobogura.org',
      },
    ],
    phone: '+880 1711 000000',
    emergencyHotline: '16300',
    email: 'info@vdobogura.org',
    officeHours: 'রবিবার - বৃহস্পতিবার: সকাল ৯:০০ - বিকাল ৫:০০ (শুক্র ও শনিবার বন্ধ)',
    mapLat: 24.8481,
    mapLng: 89.373,
    registrationNumber: 'সমাজসেবা অধিদপ্তর রজি: নং- বগুড়া-০৮৬৪১৮ / এনজিও বিষয়ক ব্যুরো রজি: নং- ২৫৪০',
    establishedYear: 2010,
    socialLinks: {
      facebook: 'https://facebook.com',
      youtube: 'https://youtube.com',
      linkedin: 'https://linkedin.com',
      twitter: 'https://twitter.com',
    },
  };
}

// Seed on module import
seedInMemoryStore();
