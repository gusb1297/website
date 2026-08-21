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
  PageContent,
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

/**
 * Admin accounts are the only entity that always lives in MongoDB - they are
 * created, edited and deleted from the "Admin Users" tab of the admin panel.
 */
const AdminSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['admin', 'editor'], default: 'admin' },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const SiteSettingsSchema = new Schema({
  ngoName: String,
  ngoNameEn: String,
  ngoTagline: String,
  logoUrl: String,
  address: String,
  addressEn: String,
  branchAddresses: Array,
  phone: String,
  emergencyHotline: String,
  email: String,
  officeHours: String,
  officeHoursEn: String,
  headerLocation: Object,
  footerAbout: Object,
  footerCopyright: Object,
  mapLat: Number,
  mapLng: Number,
  registrationNumber: String,
  establishedYear: Number,
  socialLinks: Object,
  theme: {
    primary: String,
    accent: String,
  },
});

const PageContentSchema = new Schema({
  home: Object,
  about: Object,
  updatedAt: { type: Date, default: Date.now },
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
export interface AdminDocument extends mongoose.Document {
  name: string;
  email: string;
  passwordHash: string;
  role: 'admin' | 'editor';
  isActive: boolean;
  lastLoginAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export const MAdmin: mongoose.Model<AdminDocument> =
  (mongoose.models.Admin as mongoose.Model<AdminDocument>) ||
  mongoose.model<AdminDocument>('Admin', AdminSchema);
export const MSiteSettings = mongoose.models.SiteSettings || mongoose.model('SiteSettings', SiteSettingsSchema);
export const MPageContent = mongoose.models.PageContent || mongoose.model('PageContent', PageContentSchema);

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
  pageContent: null as unknown as PageContent,
};

/** Default site-wide brand colors (editable from the admin color picker). */
export const DEFAULT_THEME = { primary: '#1B3022', accent: '#B38B4D' };
/**
 * Reset the content store to an empty, ready-to-fill state.
 *
 * The project ships with NO demo/mock content: every hero slide, project, news
 * item, video, notice, publication, photo, committee member, partner, career
 * circular and statistic is created by an administrator from the admin panel.
 * Only neutral bilingual interface labels (section headings and button texts)
 * are pre-filled so the public pages keep their structure while empty.
 */
export function initializeContentStore() {
  memoryStore.heroSlides = [];
  memoryStore.programs = [];
  memoryStore.news = [];
  memoryStore.videos = [];
  memoryStore.notices = [];
  memoryStore.publications = [];
  memoryStore.galleryAlbums = [];
  memoryStore.galleryPhotos = [];
  memoryStore.committee = [];
  memoryStore.partners = [];
  memoryStore.careers = [];
  memoryStore.applications = [];
  memoryStore.stats = [];

  memoryStore.settings = {
    ngoName: '',
    ngoNameEn: '',
    ngoTagline: '',
    logoUrl: '',
    address: '',
    addressEn: '',
    branchAddresses: [],
    phone: '',
    emergencyHotline: '',
    email: '',
    officeHours: '',
    officeHoursEn: '',
    headerLocation: { bn: '', en: '' },
    footerAbout: { bn: '', en: '' },
    footerCopyright: { bn: 'সর্বস্বত্ব সংরক্ষিত।', en: 'All rights reserved.' },
    mapLat: 0,
    mapLng: 0,
    registrationNumber: '',
    establishedYear: 0,
    socialLinks: { facebook: '', youtube: '', linkedin: '', twitter: '' },
    theme: { ...DEFAULT_THEME },
  };

  // Interface labels only - all descriptive copy is written by the admin.
  memoryStore.pageContent = {
    home: {
      noticeBadge: { bn: 'বিশেষ নোটিশ', en: 'SPECIAL NOTICE' },
      viewNotice: { bn: 'নোটিশ দেখুন', en: 'VIEW NOTICE' },
      establishedBadge: { bn: '', en: '' },
      teaserTitle: { bn: '', en: '' },
      teaserText: { bn: '', en: '' },
      visionTitle: { bn: 'আমাদের ভিশন', en: 'Our Vision' },
      visionText: { bn: '', en: '' },
      missionTitle: { bn: 'আমাদের মিশন', en: 'Our Mission' },
      missionText: { bn: '', en: '' },
      learnMoreCta: { bn: 'আমাদের সম্পর্কে আরো জানুন', en: 'Learn More About Us' },
      teaserImage: '',
      teaserImageLabel: { bn: '', en: '' },
      teaserImageCaption: { bn: '', en: '' },
      programsBadge: { bn: 'আমাদের কার্যক্রম', en: 'Our Activities' },
      programsTitle: { bn: 'প্রজেক্টসমূহ', en: 'Our Projects' },
      viewAllPrograms: { bn: 'সব প্রজেক্ট দেখুন', en: 'View All Projects' },
      videoBadge: { bn: 'ভিডিও', en: 'Videos' },
      videoTitle: { bn: 'ভিডিও গ্যালারি', en: 'Video Gallery' },
      videoText: { bn: '', en: '' },
      watchAllVideos: { bn: 'সব ভিডিও দেখুন', en: 'Watch All Videos' },
      newsBadge: { bn: 'সংবাদ ও ইভেন্ট', en: 'News & Events' },
      newsTitle: { bn: 'সাম্প্রতিক খবর', en: 'Latest News' },
      readAllNews: { bn: 'সব খবর দেখুন', en: 'Read All News' },
      partnersTitle: { bn: 'আমাদের সহযোগী ও অংশীদার', en: 'Our Partners & Donors' },
    },
    about: {
      bannerBadge: { bn: 'আমাদের পরিচিতি', en: 'About Us' },
      bannerTitle: { bn: '', en: '' },
      bannerSub: { bn: '', en: '' },
      historyTitle: { bn: 'সংস্থার ইতিহাস', en: 'Organization History' },
      history1: { bn: '', en: '' },
      history2: { bn: '', en: '' },
      vision: { bn: '', en: '' },
      mission: { bn: '', en: '' },
      messageSectionBadge: { bn: 'নেতৃত্বের বার্তা', en: 'Leadership Message' },
      messageSectionTitle: { bn: 'চেয়ারম্যান ও নির্বাহী পরিচালকের বক্তব্য', en: 'Message from the Chairman & Executive Director' },
      chairman: {
        name: { bn: '', en: '' },
        title: { bn: '', en: '' },
        message: { bn: '', en: '' },
        photo: '',
      },
      director: {
        name: { bn: '', en: '' },
        title: { bn: '', en: '' },
        message: { bn: '', en: '' },
        photo: '',
      },
      legalBadge: { bn: 'আইনগত স্বীকৃতি', en: 'Legal Status' },
      legalTitle: { bn: '', en: '' },
      legalSub: { bn: '', en: '' },
      legalItems: [],
    },
  };
}

// Initialise on module import (persisted admin content is layered on top of
// this by server/config/persistence.ts at boot).
initializeContentStore();
