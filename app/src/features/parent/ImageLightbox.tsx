type ImageLightboxProps = {
  imagePath: string | null;
  alt?: string;
  label?: string;
  onClose: () => void;
};

export function ImageLightbox({ imagePath, alt = "Image", label, onClose }: ImageLightboxProps) {
  if (!imagePath) return null;

  return (
    <div className="image-lightbox-overlay" onClick={onClose}>
      <div className="image-lightbox-content" onClick={(e) => e.stopPropagation()}>
        <div className="image-lightbox-header">
          {label && <span className="image-lightbox-label">{label}</span>}
          <button className="image-lightbox-close" onClick={onClose} type="button" aria-label="閉じる">
            ✕
          </button>
        </div>
        <img src={imagePath} alt={alt} className="image-lightbox-image" />
      </div>
    </div>
  );
}
