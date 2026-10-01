import { MandalaMotif } from "@/components/sections/MandalaMotif";
import { cn } from "@/lib/utils/cn";

type ProductImagePlaceholderProps = {
  className?: string;
};

/**
 * Stands in for product photography until real images are added to
 * public/images/products. Reuses the hero's mandala line-art on a soft
 * tinted ground, rather than a plain gray box, so the catalog still
 * feels on-brand before photography exists.
 */
export function ProductImagePlaceholder({
  className,
}: ProductImagePlaceholderProps) {
  return (
    <div
      className={cn(
        "flex aspect-square items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_45%,_var(--shilpikala-terracotta)_0%,_transparent_70%)] bg-[length:140%_140%] bg-terracotta/[0.06]",
        className
      )}
    >
      <MandalaMotif className="h-2/3 w-2/3 opacity-70" />
    </div>
  );
}
