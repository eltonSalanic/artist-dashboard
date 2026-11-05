import { compressImage } from "./compress-image";

describe("compressImage", () => {
  it("leaves anything that isn't a photo untouched", async () => {
    const png = new File(["x"], "stage-plot.png", { type: "image/png" });
    const pdf = new File(["x"], "rider.pdf", { type: "application/pdf" });
    await expect(compressImage(png)).resolves.toBe(png);
    await expect(compressImage(pdf)).resolves.toBe(pdf);
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
