import React, { useState } from 'react';
import { GalleryAlbum, GalleryPhoto } from '../types';
import { Image, X, ZoomIn, Eye } from 'lucide-react';

interface GalleryGridProps {
  albums: GalleryAlbum[];
  photos: GalleryPhoto[];
}

export const GalleryGrid: React.FC<GalleryGridProps> = ({ albums, photos }) => {
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | 'all'>('all');
  const [activePhoto, setActivePhoto] = useState<GalleryPhoto | null>(null);

  const filteredPhotos =
    selectedAlbumId === 'all'
      ? photos
      : photos.filter((p) => p.albumId === selectedAlbumId);

  return (
    <div className="space-y-8">
      {/* Album Filter Tabs */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          onClick={() => setSelectedAlbumId('all')}
          className={`px-4 py-2 rounded-full text-xs font-semibold transition-all ${
            selectedAlbumId === 'all'
              ? 'bg-amber-500 text-slate-950 shadow-md scale-105'
              : 'bg-emerald-900/40 text-emerald-100 hover:bg-emerald-900'
          }`}
        >
          সব অ্যালবামের ছবি ({photos.length})
        </button>

        {albums.map((album) => (
          <button
            key={album.id}
            onClick={() => setSelectedAlbumId(album.id)}
            className={`px-4 py-2 rounded-full text-xs font-semibold transition-all ${
              selectedAlbumId === album.id
                ? 'bg-amber-500 text-slate-950 shadow-md scale-105'
                : 'bg-emerald-900/40 text-emerald-100 hover:bg-emerald-900'
            }`}
          >
            {album.title}
          </button>
        ))}
      </div>

      {/* Masonry Grid */}
      <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
        {filteredPhotos.map((photo) => (
          <div
            key={photo.id}
            onClick={() => setActivePhoto(photo)}
            className="break-inside-avoid relative rounded-2xl overflow-hidden group cursor-pointer border border-slate-200 shadow-md hover:shadow-2xl transition-all"
          >
            <img
              src={photo.image}
              alt={photo.caption}
              className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4 text-white">
              <p className="text-xs font-medium leading-snug text-amber-300">{photo.caption}</p>
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-300 mt-1">
                <ZoomIn className="w-3 h-3 text-amber-400" /> বড় করে দেখুন
              </span>
            </div>
          </div>
        ))}
      </div>

      {filteredPhotos.length === 0 && (
        <div className="text-center py-12 text-slate-500 font-serif">
          <p>এই অ্যালবামে এখনও কোনো ছবি আপলোড করা হয়নি।</p>
        </div>
      )}

      {/* Lightbox Modal */}
      {activePhoto && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setActivePhoto(null)}
        >
          <div
            className="relative max-w-4xl w-full bg-emerald-950 rounded-2xl overflow-hidden border border-amber-500/40 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setActivePhoto(null)}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-slate-900/80 text-white hover:bg-amber-500 hover:text-slate-950 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="max-h-[75vh] overflow-hidden bg-black flex items-center justify-center">
              <img
                src={activePhoto.image}
                alt={activePhoto.caption}
                className="max-h-[75vh] w-auto object-contain"
              />
            </div>

            <div className="p-4 bg-emerald-950 text-white border-t border-emerald-900">
              <p className="text-sm font-medium text-amber-300">{activePhoto.caption}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
