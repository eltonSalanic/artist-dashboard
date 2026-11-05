import { compressImage, prepareImage } from "./compress-image";

describe("compressImage", () => {
  it("leaves anything that isn't a photo untouched", async () => {
    const png = new File(["x"], "stage-plot.png", { type: "image/png" });
    const pdf = new File(["x"], "rider.pdf", { type: "application/pdf" });
    await expect(compressImage(png)).resolves.toBe(png);
    await expect(compressImage(pdf)).resolves.toBe(pdf);
  });

  it("makes no preview for a file it can't draw", async () => {
    const pdf = new File(["x"], "rider.pdf", { type: "application/pdf" });
    await expect(prepareImage(pdf)).resolves.toEqual({ file: pdf });
  });

  it("uploads the original when the browser can't decode the photo", async () => {
    const original = globalThis.createImageBitmap;
    globalThis.createImageBitmap = jest
      .fn()
      .mockRejectedValue(new Error("unsupported")) as typeof createImageBitmap;
    const heic = new File(["x"], "IMG_0042.HEIC", { type: "image/heic" });
    await expect(compressImage(heic)).resolves.toBe(heic);
    globalThis.createImageBitmap = original;
  });
});
