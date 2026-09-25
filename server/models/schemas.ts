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

/**
 * Content models live in `server/services/contentStore.ts`, which stores every
 * entity as a document in its own MongoDB collection through
 * `server/config/contentDb.ts`. The only Mongoose model left here is `Admin`,
 * because admin accounts need bcrypt hashing and an index on the email.
 */

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

// In-memory read cache for the site content.
//
// It is NOT a store: it is filled from MongoDB at boot (server/services/
// contentStore.ts) and every change is written straight back to MongoDB. The
// controllers read from it so serving a page never needs a database round trip.
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
