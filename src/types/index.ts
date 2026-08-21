export interface BilingualText {
  bn: string;
  en: string;
}

export interface HeroSlide {
  id: string;
  image: string;
  headline: string;
  subtext: string;
  buttonText?: string;
  buttonLink?: string;
  order: number;
  isActive: boolean;
}

export interface Program {
  id: string;
  title: string;
  slug: string;
  icon: string;
  shortDesc: string;
  content: string;
  coverImage: string;
  status: 'ongoing' | 'completed';
  order: number;
  beneficiariesCount?: number;
  districtsCovered?: number;
}

export interface NewsItem {
  id: string;
  title: string;
  slug: string;
  category: 'News' | 'Event' | 'Press Release' | 'Impact Story';
  thumbnail: string;
  content: string;
  publishedAt: string;
  views: number;
  author?: string;
}

export type VideoStorage = 'cloudinary' | 'local';
export type VideoProviderName = 'youtube' | 'vimeo' | 'external';

export interface VideoItem {
  id: string;
  title: string;
  /** `upload` = file from a device (Cloudinary / local disk), `embed` = YouTube / Vimeo link. */
  type: 'upload' | 'embed';
  /** Playable URL of an uploaded file (Cloudinary secure URL or local /uploads path). */
  filePath?: string;
  /** Cloudinary public id, kept so deleting the video also deletes the asset. */
  publicId?: string;
  /** Where an uploaded file physically lives. */
  storage?: VideoStorage;
  /** Provider of an embedded video. */
  provider?: VideoProviderName;
  /** Provider video id (e.g. the YouTube 11-char id). */
  providerId?: string;
  /** Original link the admin pasted / provider watch page. */
  watchUrl?: string;
  thumbnail: string;
  embedUrl?: string;
  duration?: string;
  durationSeconds?: number;
  sizeBytes?: number;
  uploadedAt: string;
  category?: string;
  description?: string;
}

export interface Notice {
  id: string;
  title: string;
  pdfFile: string;
  publishedAt: string;
  expiryDate?: string;
  isActive: boolean;
  referenceNo?: string;
}

export interface Publication {
  id: string;
  title: string;
  type: 'annual_report' | 'newsletter' | 'report';
  pdfFile: string;
  year: number;
  thumbnail?: string;
}

export interface GalleryAlbum {
  id: string;
  title: string;
  coverImage: string;
  description?: string;
  createdAt: string;
}

export interface GalleryPhoto {
  id: string;
  albumId: string;
  image: string;
  caption: string;
  uploadedAt: string;
}

export interface CommitteeMember {
  id: string;
  name: string;
  designation: string;
  type: 'general' | 'executive' | 'advisory' | 'leadership';
  photo: string;
  bio: string;
  order: number;
  email?: string;
  phone?: string;
}

export interface Partner {
  id: string;
  name: string;
  logo: string;
  websiteUrl: string;
}

export interface CareerCircular {
  id: string;
  title: string;
  deadline: string;
  description: string;
  location: string;
  vacancy: number;
  pdfFile?: string;
  isActive: boolean;
  createdAt: string;
}

export interface Application {
  id: string;
  careerId: string;
  jobTitle?: string;
  name: string;
  email: string;
  phone: string;
  cvFile?: string;
  cvUrl?: string;
  notes?: string;
  submittedAt: string;
}

export type Applicant = Application;

export interface StatItem {
  id: string;
  label: string;
  value: number;
  suffix?: string;
  icon: string;
  order: number;
}

export type AdminRole = 'admin' | 'editor';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
}

/** Admin account as returned by /api/admins (stored in MongoDB). */
export interface AdminAccount extends AdminUser {
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  lastLoginAt?: string | null;
}

export interface BranchOffice {
  name: string;
  address: string;
  phone: string;
  email: string;
}

/** Site-wide theme colors, editable from the admin panel (color picker). */
export interface ThemeColors {
  /** Primary dark brand color (default #1B3022 - deep green) */
  primary: string;
  /** Accent brand color (default #B38B4D - gold) */
  accent: string;
}

export interface SiteSettings {
  ngoName: string;
  ngoNameEn: string;
  ngoTagline: string;
  logoUrl?: string;
  address: string;
  addressEn: string;
  branchAddresses: BranchOffice[];
  phone: string;
  emergencyHotline: string;
  email: string;
  officeHours: string;
  officeHoursEn: string;
  /** Short location line shown in the top header bar (e.g. "Bogura Sadar, Bogura, Bangladesh") */
  headerLocation: BilingualText;
  /** Short about text shown in the footer */
  footerAbout: BilingualText;
  /** Copyright line shown at the bottom of the footer */
  footerCopyright: BilingualText;
  mapLat: number;
  mapLng: number;
  registrationNumber: string;
  establishedYear: number;
  socialLinks: {
    facebook: string;
    youtube: string;
    linkedin: string;
    twitter: string;
  };
  theme: ThemeColors;
}

/** Editable copy for the Home page (fetched from /api/page-content). */
export interface HomePageContent {
  /** Notice ticker label, e.g. "SPECIAL NOTICE" / "বিশেষ নোটিশ" */
  noticeBadge: BilingualText;
  /** Notice ticker CTA, e.g. "VIEW NOTICE" / "নোটিশ দেখুন" */
  viewNotice: BilingualText;
  establishedBadge: BilingualText;
  teaserTitle: BilingualText;
  teaserText: BilingualText;
  visionTitle: BilingualText;
  visionText: BilingualText;
  missionTitle: BilingualText;
  missionText: BilingualText;
  learnMoreCta: BilingualText;
  /** Image shown on the right side of the about teaser */
  teaserImage: string;
  teaserImageLabel: BilingualText;
  teaserImageCaption: BilingualText;
  programsBadge: BilingualText;
  programsTitle: BilingualText;
  viewAllPrograms: BilingualText;
  videoBadge: BilingualText;
  videoTitle: BilingualText;
  videoText: BilingualText;
  watchAllVideos: BilingualText;
  newsBadge: BilingualText;
  newsTitle: BilingualText;
  readAllNews: BilingualText;
  partnersTitle: BilingualText;
}

/** Editable copy for the About page. */
export interface LeaderProfile {
  name: BilingualText;
  title: BilingualText;
  message: BilingualText;
  photo: string;
}

export interface AboutPageContent {
  bannerBadge: BilingualText;
  bannerTitle: BilingualText;
  bannerSub: BilingualText;
  historyTitle: BilingualText;
  history1: BilingualText;
  history2: BilingualText;
  vision: BilingualText;
  mission: BilingualText;
  messageSectionBadge: BilingualText;
  messageSectionTitle: BilingualText;
  chairman: LeaderProfile;
  director: LeaderProfile;
  legalBadge: BilingualText;
  legalTitle: BilingualText;
  legalSub: BilingualText;
  /** e.g. registration numbers shown in the legal box */
  legalItems: BilingualText[];
}

export interface PageContent {
  home: HomePageContent;
  about: AboutPageContent;
}
