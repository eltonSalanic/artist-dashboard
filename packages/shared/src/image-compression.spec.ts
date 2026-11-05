import {
  canThumbnail,
  compressedImageName,
  fitWithin,
  isCompressibleImage,
} from "./image-compression";

describe("fitWithin", () => {
  it("scales the long edge down to the cap and keeps the shape", () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: 2048, height: 1536 });
    expect(fitWithin(3024, 4032)).toEqual({ width: 1536, height: 2048 });
  });

  it("never enlarges a small image", () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it("takes another cap, e.g. for thumbnails", () => {
    expect(fitWithin(2048, 1024, 400)).toEqual({ width: 400, height: 200 });
  });
});

describe("isCompressibleImage", () => {
  it("compresses photos only", () => {
    expect(isCompressibleImage("image/jpeg")).toBe(true);
    expect(isCompressibleImage("image/HEIC")).toBe(true);
    expect(isCompressibleImage("image/png")).toBe(false);
    expect(isCompressibleImage("image/gif")).toBe(false);
    expect(isCompressibleImage("application/pdf")).toBe(false);
  });
});

describe("compressedImageName", () => {
  it("swaps the extension for .jpg", () => {
    expect(compressedImageName("IMG_0042.HEIC")).toBe("IMG_0042.jpg");
    expect(compressedImageName("van.jpeg")).toBe("van.jpg");
    expect(compressedImageName("noext")).toBe("noext.jpg");
  });
});

describe("canThumbnail", () => {
  it("previews photos and PNGs, not GIFs or SVGs", () => {
    expect(canThumbnail("image/jpeg")).toBe(true);
    expect(canThumbnail("image/PNG")).toBe(true);
    expect(canThumbnail("image/gif")).toBe(false);
    expect(canThumbnail("image/svg+xml")).toBe(false);
    expect(canThumbnail("application/pdf")).toBe(false);
  });
});
