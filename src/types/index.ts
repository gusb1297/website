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

export interface VideoItem {
  id: string;
  title: string;
  type: 'upload' | 'embed';
  filePath?: string;
  thumbnail: string;
  embedUrl?: string;
  duration?: string;
  uploadedAt: string;
  category?: string;
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

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'editor';
}

export interface BranchOffice {
  name: string;
  address: string;
  phone: string;
  email: string;
}

export interface SiteSettings {
  ngoName: string;
  ngoTagline: string;
  logoUrl?: string;
  address: string;
  branchAddresses: BranchOffice[];
  phone: string;
  emergencyHotline: string;
  email: string;
  officeHours: string;
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
}
