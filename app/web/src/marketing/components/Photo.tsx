import { images, imageSrcSet, imageUrl, type ImageKey, type MarketingImage } from '../content/images';
import { cn } from '@/lib/utils';

/** Lazy-loaded photo from the image registry: fixed aspect ratio, rounded, hairline, slow subtle zoom on hover. */
export function Photo({
  image,
  ratio = '4 / 3',
  sizes = '(min-width: 1024px) 50vw, 100vw',
  className,
  imgClassName,
  priority = false,
}: {
  image: ImageKey | MarketingImage;
  /** CSS aspect-ratio, e.g. '4 / 3', '3 / 4', '16 / 9' */
  ratio?: string;
  sizes?: string;
  className?: string;
  imgClassName?: string;
  /** above the fold: load eagerly */
  priority?: boolean;
}) {
  const img = typeof image === 'string' ? images[image] : image;
  return (
    <div className={cn('group/photo relative overflow-hidden rounded-xl border border-line bg-surface-2', className)} style={{ aspectRatio: ratio }}>
      <img
        src={imageUrl(img, 1200)}
        srcSet={imageSrcSet(img)}
        sizes={sizes}
        alt={img.alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        className={cn('size-full object-cover transition-transform duration-700 ease-brand group-hover/photo:scale-[1.03]', imgClassName)}
      />
    </div>
  );
}
