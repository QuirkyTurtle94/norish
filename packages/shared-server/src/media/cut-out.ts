/**
 * The cut-out: making the flat background a picture is drawn on see-through,
 * on RGBA pixels as sharp's raw output gives them (four bytes a pixel, row by
 * row), changed in place. Two ways, for two kinds of picture:
 *
 * - Artwork of any colours: a flood from the border takes the background
 *   away and keeps a patch of its colour inside the artwork, and `defringe`
 *   then trims the line of mixed pixels the flood leaves along every edge.
 * - A mark of one colour, such as a logo, an icon or lettering: `cutOutMark`
 *   reads every pixel as a mix of the mark's colour and the background's, so
 *   a smooth edge stays smooth and keeps nothing of the old background.
 *
 * Ingredient Icons cut a drawing free with the flood; the cut-out tool in
 * `tooling/cut-out` offers both ways for any picture.
 */

/** A colour as its red, green and blue, each 0–255. */
export type Rgb = readonly [number, number, number];

/**
 * How far a pixel's colour may stray from the background's and still be
 * background, as a distance in RGB. Loose enough for a camera's noise and a
 * drawn background's faint falloff, tight enough that a pale food's outline
 * stops the flood. The Ingredient Icons' sample sheet is where this gets tuned.
 */
export const TOLERANCE = 32;
/** How much of the border must be one colour for a picture to have a background to remove. */
const FLAT_BORDER = 0.9;
/**
 * Where a mark's opacity snaps: a pixel within this share of the way from
 * the background's colour to the mark's is clear, and one within it of the
 * mark's is solid, so a camera's or a JPEG's noise leaves no faint specks
 * around the mark and no faint holes in it.
 */
const SNAP = 0.04;
/**
 * A blur over a pixel and its eight neighbours, about half a pixel wide:
 * the weight of the pixel itself, of a side neighbour and of a corner one.
 */
const FEATHER = (() => {
  const sigma = 0.6;
  const weight = (squared: number) => Math.exp(-squared / (2 * sigma * sigma));
  const total = weight(0) + 4 * weight(1) + 4 * weight(2);

  return [weight(0) / total, weight(1) / total, weight(2) / total] as const;
})();

/** Every pixel along the picture's four edges. */
function borderPixels(width: number, height: number): number[] {
  const border: number[] = [];

  for (let x = 0; x < width; x++) border.push(x, (height - 1) * width + x);
  for (let y = 1; y < height - 1; y++) border.push(y * width, y * width + width - 1);

  return border;
}

/** The squared distance in RGB between a pixel's colour and another colour. */
function distanceSquared(pixels: Buffer, pixel: number, color: Rgb): number {
  const at = pixel * 4;
  const dr = pixels[at]! - color[0];
  const dg = pixels[at + 1]! - color[1];
  const db = pixels[at + 2]! - color[2];

  return dr * dr + dg * dg + db * db;
}

/**
 * The colour of the flat background touching the picture's edges: the
 * median of its border, when nearly all of the border is within the
 * tolerance of it. A border that is not one colour has no background to
 * remove: null.
 */
function flatBackground(
  pixels: Buffer,
  width: number,
  height: number,
  tolerance: number
): Rgb | null {
  const border = borderPixels(width, height);
  const median = (channel: number) => {
    const values = border.map((pixel) => pixels[pixel * 4 + channel]!).sort((a, b) => a - b);

    return values[values.length >> 1]!;
  };
  const background: Rgb = [median(0), median(1), median(2)];
  const flat = border.filter(
    (pixel) => distanceSquared(pixels, pixel, background) <= tolerance * tolerance
  );

  return flat.length >= border.length * FLAT_BORDER ? background : null;
}

/**
 * Make the flat background touching the picture's edges see-through, by a
 * flood from the border: a pixel goes when it is the background's colour and
 * joins the border through pixels that are too, so a patch of that colour
 * inside the artwork stays. A border that is not one colour has no
 * background to remove, and the picture is left alone. Says whether it cut.
 */
export function cutOutBackground(
  pixels: Buffer,
  width: number,
  height: number,
  tolerance = TOLERANCE
): boolean {
  const background = flatBackground(pixels, width, height, tolerance);

  if (!background) return false;

  const isBackground = (pixel: number) =>
    distanceSquared(pixels, pixel, background) <= tolerance * tolerance;
  const seen = new Uint8Array(width * height);
  const stack: number[] = [];
  const visit = (pixel: number) => {
    if (seen[pixel] || !isBackground(pixel)) return;
    seen[pixel] = 1;
    stack.push(pixel);
  };

  borderPixels(width, height).forEach(visit);
  while (stack.length > 0) {
    const pixel = stack.pop()!;
    const x = pixel % width;

    pixels[pixel * 4 + 3] = 0;
    if (x > 0) visit(pixel - 1);
    if (x < width - 1) visit(pixel + 1);
    if (pixel >= width) visit(pixel - width);
    if (pixel < width * (height - 1)) visit(pixel + width);
  }

  return true;
}

/**
 * Trim the line of mixed pixels a flood leaves along the artwork's edge,
 * half artwork and half the old background (a white background leaves a
 * pale outline that shows on a dark page), and smooth the stepped edge that
 * remains: every pixel touching a see-through one goes, and the new edge is
 * feathered across a pixel either way. A feathered pixel outside the artwork
 * takes the colour of the artwork beside it, never the background's. It
 * costs the artwork a pixel along every edge, which a tiny picture may not
 * be able to spare.
 */
export function defringe(pixels: Buffer, width: number, height: number): void {
  const clear = (pixel: number) => pixels[pixel * 4 + 3] === 0;
  const kept = new Uint8Array(width * height);

  for (let pixel = 0; pixel < kept.length; pixel++) {
    const x = pixel % width;

    kept[pixel] = Number(
      !clear(pixel) &&
        !(x > 0 && clear(pixel - 1)) &&
        !(x < width - 1 && clear(pixel + 1)) &&
        !(pixel >= width && clear(pixel - width)) &&
        !(pixel < kept.length - width && clear(pixel + width))
    );
  }

  // Only a kept pixel's colour is ever read below, and only a pixel that is
  // not kept is ever repainted, so the pixels can change as the loop goes.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const at = (y * width + x) * 4;
      let opacity = 0;
      let red = 0;
      let green = 0;
      let blue = 0;

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          // Past the picture's edge, the edge pixel stands in for its neighbour.
          const ny = Math.min(height - 1, Math.max(0, y + dy));
          const nx = Math.min(width - 1, Math.max(0, x + dx));
          const neighbour = ny * width + nx;

          if (!kept[neighbour]) continue;

          const weight = FEATHER[Math.abs(dx) + Math.abs(dy)]!;

          opacity += weight;
          red += weight * pixels[neighbour * 4]!;
          green += weight * pixels[neighbour * 4 + 1]!;
          blue += weight * pixels[neighbour * 4 + 2]!;
        }
      }

      if (!kept[y * width + x] && opacity > 0) {
        pixels[at] = Math.round(red / opacity);
        pixels[at + 1] = Math.round(green / opacity);
        pixels[at + 2] = Math.round(blue / opacity);
      }
      pixels[at + 3] = Math.round(opacity * 255);
    }
  }
}

/**
 * The commonest colour clearly apart from the background's: a mark's solid
 * body outnumbers its edge, whose mixed pixels spread over many shades.
 * Colours are counted in steps of eight a channel, and the answer is the
 * average of the pixels in the winning step. Null when every pixel is
 * background.
 */
function commonestColor(pixels: Buffer, background: Rgb, tolerance: number): Rgb | null {
  const counts = new Uint32Array(1 << 15);
  const sums = new Float64Array(3 << 15);
  let best = -1;

  for (let pixel = 0; pixel < pixels.length / 4; pixel++) {
    if (distanceSquared(pixels, pixel, background) <= tolerance * tolerance) continue;

    const at = pixel * 4;
    const step =
      ((pixels[at]! >> 3) << 10) | ((pixels[at + 1]! >> 3) << 5) | (pixels[at + 2]! >> 3);

    counts[step] = counts[step]! + 1;
    for (let channel = 0; channel < 3; channel++) {
      sums[step * 3 + channel] = sums[step * 3 + channel]! + pixels[at + channel]!;
    }
    if (best < 0 || counts[step]! > counts[best]!) best = step;
  }

  if (best < 0) return null;

  const count = counts[best]!;

  return [
    Math.round(sums[best * 3]! / count),
    Math.round(sums[best * 3 + 1]! / count),
    Math.round(sums[best * 3 + 2]! / count),
  ];
}

/**
 * Cut a mark of one colour (a logo, an icon, lettering) out of the flat
 * background it is drawn on. Every pixel is read as a mix of the mark's
 * colour and the background's: how much of the mark it holds is how opaque
 * it becomes, and it is painted one colour, so a smooth edge stays smooth and
 * keeps nothing of the old background, and a hole in the mark (the inside of
 * an O) is see-through too. The mark's colour is the commonest one clearly
 * apart from the background; `color` paints the mark another, such as the
 * exact brand colour a JPEG has drifted from.
 *
 * Answers the background's colour and the mark's as found, or null when the
 * border is not one flat colour. A picture of nothing but its background
 * comes out wholly see-through.
 */
export function cutOutMark(
  pixels: Buffer,
  width: number,
  height: number,
  { color, tolerance = TOLERANCE }: { color?: Rgb; tolerance?: number } = {}
): { background: Rgb; mark: Rgb } | null {
  const background = flatBackground(pixels, width, height, tolerance);

  if (!background) return null;

  const mark = commonestColor(pixels, background, tolerance) ?? background;
  const paint = color ?? mark;
  const toMark = [mark[0] - background[0], mark[1] - background[1], mark[2] - background[2]];
  const span = toMark[0]! ** 2 + toMark[1]! ** 2 + toMark[2]! ** 2;

  for (let at = 0; at < pixels.length; at += 4) {
    // How far along the way from the background's colour to the mark's this pixel lies.
    let share = 0;

    for (let channel = 0; channel < 3 && span > 0; channel++) {
      share += ((pixels[at + channel]! - background[channel]!) * toMark[channel]!) / span;
    }

    pixels[at] = paint[0];
    pixels[at + 1] = paint[1];
    pixels[at + 2] = paint[2];
    pixels[at + 3] = Math.round(255 * Math.min(1, Math.max(0, (share - SNAP) / (1 - 2 * SNAP))));
  }

  return { background, mark };
}
