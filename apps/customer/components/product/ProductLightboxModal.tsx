"use client";

import { useState } from "react";
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";

interface ProductLightboxModalProps {
  images: Array<{ url: string; id?: string }>;
  initialIndex?: number;
  isOpen: boolean;
  onClose: () => void;
  productName: string;
}

export function ProductLightboxModal({
  images,
  initialIndex = 0,
  isOpen,
  onClose,
  productName,
}: ProductLightboxModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoomed, setZoomed] = useState(false);

  if (!isOpen || images.length === 0) return null;

  const currentImage = images[currentIndex] || images[0];

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
    setZoomed(false);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
    setZoomed(false);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md animate-in fade-in duration-200"
    >
      {/* Top control bar */}
      <div className="absolute top-4 inset-x-4 flex items-center justify-between z-10 text-white pointer-events-none">
        <div className="pointer-events-auto bg-black/40 px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-sm">
          {productName} ({currentIndex + 1} / {images.length})
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setZoomed(!zoomed);
            }}
            title={zoomed ? "Zoom Out" : "Zoom In"}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
          >
            {zoomed ? <ZoomOut size={16} /> : <ZoomIn size={16} />}
          </button>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Main Image Viewport */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative max-w-5xl max-h-[85vh] w-full flex items-center justify-center p-4 overflow-hidden"
      >
        <img
          src={currentImage.url}
          alt={productName}
          className={`max-h-[80vh] max-w-full rounded-xl object-contain transition-transform duration-300 select-none ${
            zoomed ? "scale-150 cursor-zoom-out" : "cursor-zoom-in"
          }`}
          onClick={() => setZoomed(!zoomed)}
        />

        {/* Previous Button */}
        {images.length > 1 && (
          <button
            onClick={handlePrev}
            className="absolute left-6 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 hover:bg-black/80 text-white shadow-lg backdrop-blur-sm transition-transform hover:scale-105"
          >
            <ChevronLeft size={22} />
          </button>
        )}

        {/* Next Button */}
        {images.length > 1 && (
          <button
            onClick={handleNext}
            className="absolute right-6 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 hover:bg-black/80 text-white shadow-lg backdrop-blur-sm transition-transform hover:scale-105"
          >
            <ChevronRight size={22} />
          </button>
        )}
      </div>

      {/* Bottom Thumbnail Strip */}
      {images.length > 1 && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-4 inset-x-0 flex justify-center gap-2 overflow-x-auto px-4 py-2"
        >
          {images.map((img, idx) => (
            <button
              key={idx}
              onClick={() => {
                setCurrentIndex(idx);
                setZoomed(false);
              }}
              className={`h-12 w-12 rounded-lg overflow-hidden border-2 transition-all ${
                currentIndex === idx
                  ? "border-white scale-110 shadow-lg"
                  : "border-transparent opacity-60 hover:opacity-100"
              }`}
            >
              <img src={img.url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
