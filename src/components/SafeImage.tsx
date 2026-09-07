import React, { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';

interface SafeImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src?: string | null;
  fallbackLabel?: string;
  fallbackClassName?: string;
}

/** Image with lazy decoding and a stable, accessible broken/missing fallback. */
export const SafeImage: React.FC<SafeImageProps> = ({
  src,
  alt = '',
  className = '',
  fallbackLabel = 'ছবি পাওয়া যায়নি',
  fallbackClassName = '',
  onError,
  ...props
}) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [src]);

  if (!src || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-2 bg-slate-100 text-slate-400 ${className} ${fallbackClassName}`}
        role="img"
        aria-label={alt || fallbackLabel}
      >
        <ImageOff className="h-6 w-6" aria-hidden="true" />
        <span className="px-2 text-center text-[10px] font-semibold leading-tight">{fallbackLabel}</span>
      </div>
    );
  }

  return (
    <img
      {...props}
      src={src}
      alt={alt}
      className={className}
      loading={props.loading || 'lazy'}
      decoding={props.decoding || 'async'}
      onError={(event) => {
        setFailed(true);
        onError?.(event);
      }}
    />
  );
};
