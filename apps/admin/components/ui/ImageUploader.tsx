"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, X, GripVertical, ImageIcon, Loader2 } from "lucide-react";
import { api } from "@/lib/api";

interface UploadedImage {
  id?: string;
  url: string;
  position: number;
}

interface ImageUploaderProps {
  images: UploadedImage[];
  onChange: (images: UploadedImage[]) => void;
  maxImages?: number;
  /** Single mode — one image only, no reorder grip */
  single?: boolean;
  label?: string;
  className?: string;
}

export default function ImageUploader({
  images,
  onChange,
  maxImages = 8,
  single = false,
  label,
  className = "",
}: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const effectiveMax = single ? 1 : maxImages;

  const uploadFile = useCallback(async (file: File) => {
    // Validate type
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) {
      alert("Only JPEG, PNG, WebP, and GIF images are allowed.");
      return null;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("File size must be under 5MB.");
      return null;
    }

    try {
      const res = await api.post<{ uploadUrl: string; publicUrl: string }>(
        "/upload/presigned-url",
        { fileName: file.name, contentType: file.type }
      );

      if (!res.data) throw new Error("Failed to get upload URL");

      // Upload directly to S3
      await fetch(res.data.uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      return res.data.publicUrl;
    } catch (err: any) {
      console.error("Upload failed:", err);
      alert(`Upload failed: ${err.message}`);
      return null;
    }
  }, []);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const slotsAvailable = effectiveMax - images.length;
    if (slotsAvailable <= 0) return;

    const toUpload = fileArray.slice(0, slotsAvailable);
    setUploading(true);

    const results = await Promise.all(toUpload.map(f => uploadFile(f)));
    const newImages: UploadedImage[] = [];
    let position = images.length;

    for (const url of results) {
      if (url) {
        newImages.push({ url, position: position++ });
      }
    }

    if (newImages.length > 0) {
      onChange([...images, ...newImages]);
    }

    setUploading(false);
  }, [images, effectiveMax, uploadFile, onChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const removeImage = (index: number) => {
    const updated = images.filter((_, i) => i !== index)
      .map((img, i) => ({ ...img, position: i }));
    onChange(updated);
  };

  const moveImage = (from: number, to: number) => {
    if (to < 0 || to >= images.length) return;
    const updated = [...images];
    const [moved] = updated.splice(from, 1);
    updated.splice(to, 0, moved);
    onChange(updated.map((img, i) => ({ ...img, position: i })));
  };

  if (single) {
    const img = images[0];
    return (
      <div className={className}>
        {label && (
          <p className="text-[10px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wide mb-1.5">
            {label}
          </p>
        )}
        {img ? (
          <div className="relative group inline-block">
            <img
              src={img.url}
              alt="Uploaded"
              className="h-20 w-20 rounded-lg object-cover border border-[var(--color-border)]"
            />
            <button
              type="button"
              onClick={() => onChange([])}
              title="Remove image"
              className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity shadow"
            >
              <X size={10} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex h-20 w-20 items-center justify-center rounded-lg border-2 border-dashed border-[var(--color-border)] hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-light)] transition-colors cursor-pointer"
          >
            {uploading ? (
              <Loader2 size={16} className="animate-spin text-[var(--color-text-tertiary)]" />
            ) : (
              <Upload size={16} className="text-[var(--color-text-tertiary)]" />
            )}
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
    );
  }

  return (
    <div className={className}>
      {label && (
        <p className="text-[10px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wide mb-1.5">
          {label}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {/* Existing images */}
        {images.map((img, idx) => (
          <div
            key={img.url}
            className="relative group h-16 w-16 rounded-lg overflow-hidden border border-[var(--color-border)] bg-[var(--color-bg-muted)]"
          >
            <img src={img.url} alt={`Image ${idx + 1}`} className="h-full w-full object-cover" />

            {/* Remove button */}
            <button
              type="button"
              onClick={() => removeImage(idx)}
              title="Remove image"
              className="absolute top-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500/90 text-white opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X size={8} />
            </button>

            {/* Reorder buttons */}
            {images.length > 1 && (
              <div className="absolute bottom-0 left-0 right-0 flex justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 py-0.5">
                {idx > 0 && (
                  <button type="button" onClick={() => moveImage(idx, idx - 1)}
                    className="text-white text-[8px] px-1 hover:bg-white/20 rounded">
                    ←
                  </button>
                )}
                {idx < images.length - 1 && (
                  <button type="button" onClick={() => moveImage(idx, idx + 1)}
                    className="text-white text-[8px] px-1 hover:bg-white/20 rounded">
                    →
                  </button>
                )}
              </div>
            )}

            {/* Position badge */}
            {idx === 0 && images.length > 1 && (
              <span className="absolute top-0.5 left-0.5 text-[7px] bg-[var(--color-accent)] text-white px-1 rounded font-medium">
                Main
              </span>
            )}
          </div>
        ))}

        {/* Upload button */}
        {images.length < effectiveMax && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            disabled={uploading}
            className={`flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-lg border-2 border-dashed transition-colors cursor-pointer ${
              dragOver
                ? "border-[var(--color-accent)] bg-[var(--color-accent-light)]"
                : "border-[var(--color-border)] hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-light)]"
            }`}
          >
            {uploading ? (
              <Loader2 size={14} className="animate-spin text-[var(--color-text-tertiary)]" />
            ) : (
              <>
                <ImageIcon size={14} className="text-[var(--color-text-tertiary)]" />
                <span className="text-[7px] text-[var(--color-text-tertiary)]">Upload</span>
              </>
            )}
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
