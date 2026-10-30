import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import ImageUploader from "./ImageUploader";
import { api } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  api: {
    post: vi.fn(),
  },
}));

describe("ImageUploader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "alert").mockImplementation(() => {});
  });

  it("renders existing images with remove buttons", () => {
    const existing = [
      { id: "img-1", url: "https://example.com/img1.jpg", position: 0 },
      { id: "img-2", url: "https://example.com/img2.jpg", position: 1 },
    ];
    const onChange = vi.fn();

    render(<ImageUploader images={existing} onChange={onChange} />);

    const images = screen.getAllByRole("img");
    expect(images).toHaveLength(2);
    expect(images[0]).toHaveAttribute("src", "https://example.com/img1.jpg");
  });

  it("removes an image when delete button is clicked", () => {
    const existing = [
      { id: "img-1", url: "https://example.com/img1.jpg", position: 0 },
      { id: "img-2", url: "https://example.com/img2.jpg", position: 1 },
    ];
    const onChange = vi.fn();

    render(<ImageUploader images={existing} onChange={onChange} />);

    // Click remove button on the first image
    const removeButtons = screen.getAllByTitle("Remove image");
    fireEvent.click(removeButtons[0]);

    expect(onChange).toHaveBeenCalledWith([
      { id: "img-2", url: "https://example.com/img2.jpg", position: 0 },
    ]);
  });

  it("rejects invalid file types and alerts user", async () => {
    const onChange = vi.fn();
    render(<ImageUploader images={[]} onChange={onChange} />);

    const file = new File(["dummy text"], "test.txt", { type: "text/plain" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith(
        "Only JPEG, PNG, WebP, and GIF images are allowed."
      );
    });
    expect(api.post).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("rejects files larger than 5MB", async () => {
    const onChange = vi.fn();
    render(<ImageUploader images={[]} onChange={onChange} />);

    // Create 6MB file
    const largeBlob = new Blob([new Uint8Array(6 * 1024 * 1024)], { type: "image/jpeg" });
    const file = new File([largeBlob], "large.jpg", { type: "image/jpeg" });

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith("File size must be under 5MB.");
    });
    expect(api.post).not.toHaveBeenCalled();
  });

  it("successfully requests presigned URL and uploads image to S3", async () => {
    const onChange = vi.fn();
    render(<ImageUploader images={[]} onChange={onChange} />);

    vi.mocked(api.post).mockResolvedValueOnce({
      success: true,
      data: {
        uploadUrl: "https://s3.aws.com/upload-target",
        publicUrl: "https://s3.aws.com/public-img.jpg",
      },
    });

    const s3PutFetch = vi.fn().mockResolvedValueOnce({ ok: true });
    global.fetch = s3PutFetch;

    const file = new File(["image-bytes"], "avatar.png", { type: "image/png" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/upload/presigned-url", {
        fileName: "avatar.png",
        contentType: "image/png",
      });
      expect(s3PutFetch).toHaveBeenCalledWith(
        "https://s3.aws.com/upload-target",
        expect.objectContaining({
          method: "PUT",
          headers: { "Content-Type": "image/png" },
        })
      );
      expect(onChange).toHaveBeenCalledWith([
        { url: "https://s3.aws.com/public-img.jpg", position: 0 },
      ]);
    });
  });
});

