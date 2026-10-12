/**
 * The cut-out tool on pictures sharp draws from SVG: artwork comes out cut
 * free at its full size, with no pale outline where the flood alone leaves
 * one; a mark comes out in one colour, as opaque as each pixel is mark; and a
 * picture with no background to cut is refused with the reason.
 */
import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { cutOutBackground } from "@norish/shared-server/media/cut-out";

import { cutOut, hex, parseColor } from "../src/cut-out";

const SIZE = 120;
const WHITE = `<rect width="${SIZE}" height="${SIZE}" fill="#ffffff"/>`;
const GREEN = `<rect width="${SIZE}" height="${SIZE}" fill="#336640"/>`;

/** A picture drawn from SVG shapes, as PNG or as JPEG (a camera's noise). */
function picture(shapes: string, format: "png" | "jpeg" = "png"): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">${shapes}</svg>`;
  const image = sharp(Buffer.from(svg));

  return format === "jpeg" ? image.jpeg({ quality: 85 }).toBuffer() : image.png().toBuffer();
}

/** A picture's RGBA pixels, and the one at (x, y). */
async function pixels(image: Buffer) {
  const { data, info } = await sharp(image)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const at = (x: number, y: number) => {
    const offset = (y * info.width + x) * 4;

    return { r: data[offset]!, g: data[offset + 1]!, b: data[offset + 2]!, a: data[offset + 3]! };
  };

  return { data, info, at };
}

/** How many pixels show, at all, in a pale colour: a white background's leftovers on red. */
function paleShowing(data: Buffer): number {
  let pale = 0;

  for (let offset = 0; offset < data.length; offset += 4) {
    if (data[offset + 3]! > 0 && data[offset + 1]! > 150) pale++;
  }

  return pale;
}

describe("cutOut, artwork", () => {
  it("cuts it free at its full size and keeps a patch of the background's colour inside it", async () => {
    const { bytes, colors } = await cutOut(
      await picture(
        `${WHITE}<circle cx="60" cy="60" r="40" fill="#d02020"/><circle cx="60" cy="60" r="15" fill="#ffffff"/>`,
        "jpeg"
      )
    );
    const meta = await sharp(bytes).metadata();
    const { at } = await pixels(bytes);

    expect(meta).toMatchObject({ format: "png", width: SIZE, height: SIZE, hasAlpha: true });
    expect(colors).toBeUndefined();
    expect(at(2, 2).a).toBe(0);
    expect(at(60, 30).a).toBe(255);
    expect(at(60, 60).a).toBe(255);
    expect(at(60, 60).g).toBeGreaterThan(230);
  });

  it("leaves no pale outline along the edge, where the flood alone leaves one", async () => {
    const drawn = await picture(`${WHITE}<circle cx="60" cy="60" r="40" fill="#d02020"/>`);
    const flooded = await pixels(drawn);

    cutOutBackground(flooded.data, flooded.info.width, flooded.info.height);

    expect(paleShowing(flooded.data)).toBeGreaterThan(0);
    expect(paleShowing((await pixels((await cutOut(drawn)).bytes)).data)).toBe(0);
  });

  it("writes lossless WebP when asked", async () => {
    const { bytes } = await cutOut(
      await picture(`${WHITE}<circle cx="60" cy="60" r="40" fill="#d02020"/>`),
      { format: "webp" }
    );
    const { at } = await pixels(bytes);

    expect(await sharp(bytes).metadata()).toMatchObject({ format: "webp", hasAlpha: true });
    expect(at(2, 2).a).toBe(0);
    expect(at(60, 60)).toEqual({ r: 208, g: 32, b: 32, a: 255 });
  });
});

describe("cutOut, a mark", () => {
  const CREAM_MARK = `${GREEN}<circle cx="60" cy="60" r="40" fill="#fffef7"/>`;

  it("comes out in the mark's colour, each pixel as opaque as it is mark", async () => {
    const { bytes, colors } = await cutOut(await picture(CREAM_MARK), { mark: true });
    const { data, at } = await pixels(bytes);
    let otherColour = 0;
    let partlyOpaque = 0;

    for (let offset = 0; offset < data.length; offset += 4) {
      if (data[offset] !== 255 || data[offset + 1] !== 254 || data[offset + 2] !== 247) {
        otherColour++;
      }
      if (data[offset + 3]! > 0 && data[offset + 3]! < 255) partlyOpaque++;
    }

    expect(colors).toEqual({ background: [51, 102, 64], mark: [255, 254, 247] });
    expect(at(2, 2).a).toBe(0);
    expect(at(60, 60).a).toBe(255);
    expect(otherColour).toBe(0);
    expect(partlyOpaque).toBeGreaterThan(0);
  });

  it("is painted the colour asked for", async () => {
    const { bytes } = await cutOut(await picture(CREAM_MARK), { mark: true, color: [0, 0, 0] });
    const { at } = await pixels(bytes);

    expect(at(60, 60)).toEqual({ r: 0, g: 0, b: 0, a: 255 });
    expect(at(2, 2).a).toBe(0);
  });
});

describe("cutOut refuses", () => {
  it("a picture whose border is not one flat colour", async () => {
    const halves = await picture(
      `<rect width="60" height="${SIZE}" fill="#d02020"/><rect x="60" width="60" height="${SIZE}" fill="#ffffff"/>`
    );

    await expect(cutOut(halves)).rejects.toThrow(/not one flat colour/);
    await expect(cutOut(halves, { mark: true })).rejects.toThrow(/not one flat colour/);
  });

  it("a picture that already has transparency", async () => {
    await expect(
      cutOut(await picture(`<circle cx="60" cy="60" r="40" fill="#d02020"/>`))
    ).rejects.toThrow(/already has transparency/);
  });

  it("a picture of nothing but its background", async () => {
    await expect(cutOut(await picture(WHITE))).rejects.toThrow(/nothing but its background/);
    await expect(cutOut(await picture(WHITE), { mark: true })).rejects.toThrow(
      /nothing but its background/
    );
  });
});

describe("colours as text", () => {
  it("reads #rrggbb and #rgb, the # optional, and nothing else", () => {
    expect(parseColor("#FFFEF7")).toEqual([255, 254, 247]);
    expect(parseColor(" 336640 ")).toEqual([51, 102, 64]);
    expect(parseColor("#fff")).toEqual([255, 255, 255]);
    expect(parseColor("#12345")).toBeNull();
    expect(parseColor("cream")).toBeNull();
  });

  it("writes #rrggbb", () => {
    expect(hex([255, 254, 247])).toBe("#fffef7");
    expect(hex([0, 10, 255])).toBe("#000aff");
  });
});
