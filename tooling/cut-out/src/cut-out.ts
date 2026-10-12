/**
 * The cut-out tool's work, apart from its command line: a picture's bytes
 * in, the same picture at its full size standing on nothing out. The cutting
 * itself is `@norish/shared-server/media/cut-out`, which Ingredient Icons
 * share.
 */
import sharp from "sharp";

import type { Rgb } from "@norish/shared-server/media/cut-out";
import {
  cutOutBackground,
  cutOutMark,
  defringe,
  TOLERANCE,
} from "@norish/shared-server/media/cut-out";

/** What a cut-out can be written as: the formats that keep transparency. */
export type Format = "png" | "webp";

export type CutOutOptions = {
  /** Cut a mark of one colour rather than artwork of any colours. */
  mark?: boolean;
  /** The colour to paint a mark, rather than the one it was found in. */
  color?: Rgb;
  /** How far a pixel's colour may stray from the background's and still be background. */
  tolerance?: number;
  format?: Format;
};

export type CutOut = {
  bytes: Buffer;
  /** For a mark, the background's colour and the mark's as found. */
  colors?: { background: Rgb; mark: Rgb };
};

const NOT_FLAT =
  "The picture's border is not one flat colour, so there is no background to cut away";

/** `#rgb` or `#rrggbb`, the `#` optional, as a colour; null for anything else. */
export function parseColor(text: string): Rgb | null {
  const digits = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text.trim())?.[1];

  if (!digits) return null;

  const full = digits.length === 3 ? [...digits].map((digit) => digit + digit).join("") : digits;
  const channel = (at: number) => parseInt(full.slice(at, at + 2), 16);

  return [channel(0), channel(2), channel(4)];
}

/** A colour as `#rrggbb`. */
export function hex(color: Rgb): string {
  return `#${color.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Make the flat background of a picture see-through: artwork by a flood
 * from the border, trimmed of the line of mixed pixels it leaves along every
 * edge; a mark by how much of the mark each pixel holds. Refuses a picture
 * that already has transparency, one whose border is not one flat colour,
 * and one that is nothing but its background.
 */
export async function cutOut(input: Buffer, options: CutOutOptions = {}): Promise<CutOut> {
  const { data: pixels, info } = await sharp(input)
    .rotate()
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const tolerance = options.tolerance ?? TOLERANCE;

  for (let at = 3; at < pixels.length; at += 4) {
    if (pixels[at]! < 255) throw new Error("The picture already has transparency");
  }

  let colors: CutOut["colors"];

  if (options.mark) {
    const found = cutOutMark(pixels, width, height, { color: options.color, tolerance });

    if (!found) throw new Error(NOT_FLAT);
    colors = found;
  } else {
    if (!cutOutBackground(pixels, width, height, tolerance)) throw new Error(NOT_FLAT);
    defringe(pixels, width, height);
  }

  if (!pixels.some((value, at) => at % 4 === 3 && value > 0)) {
    throw new Error("The picture holds nothing but its background");
  }

  const image = sharp(pixels, { raw: { width, height, channels: 4 } });
  const bytes = await (
    options.format === "webp" ? image.webp({ lossless: true }) : image.png()
  ).toBuffer();

  return { bytes, colors };
}
