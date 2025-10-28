import { useState } from 'react';

interface AppImageProps {
  src: string;
  alt?: string;
  className?: string;
  fallback?: string;
}

const AppImage: React.FC<AppImageProps> = ({ src, alt, className = '', fallback = '/placeholder-image.svg' }) => {
  const [imageSrc, setImageSrc] = useState<string>(src);

  const handleError = () => {
    setImageSrc(fallback);
  };

  const handleLoad = () => {
    // Image loaded successfully
  };

  return (
    <img
      src={imageSrc}
      alt={alt}
      className={className}
      onError={handleError}
      onLoad={handleLoad}
    />
  );
};

export default AppImage;
