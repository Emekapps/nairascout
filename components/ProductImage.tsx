'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Package } from 'lucide-react';

interface ProductImageProps {
  src: string;
  alt: string;
  category: string;
  className?: string;
}

export default function ProductImage({ src, alt, category, className = '' }: ProductImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-[#EFEFE9] text-[#5C665E] p-6 text-center ${className}`}
      >
        <Package className="w-8 h-8 mb-2 stroke-[1.5]" aria-hidden="true" />
        <span className="text-xs font-medium tracking-wide uppercase">{category}</span>
        <span className="text-xs mt-1 text-[#78827A] line-clamp-2 max-w-[200px]">{alt}</span>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden bg-[#EFEFE9] ${className}`}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        referrerPolicy="no-referrer"
        className="object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
        onError={() => setFailed(true)}
      />
    </div>
  );
}
