// @vitest-environment node
/**
 * The cut-out, on small pictures drawn pixel by pixel: the flood takes the
 * flat background around artwork and keeps a patch of its colour inside it,
 * `defringe` trims the mixed line the flood leaves along an edge, and a mark
 * of one colour comes out as opaque as each pixel is mark, painted one colour.
 */
import { describe, expect, it } from "vitest";

import type { Rgb } from "@norish/shared-server/media/cut-out";
import { cutOutBackground, cutOutMark, defringe } from "@norish/shared-server/media/cut-out";

type Picture = { pixels: Buffer; width: number; height: number };

/** An opaque picture, each pixel the colour `at` gives it. */
function picture(width: number, height: number, at: (x: number, y: number) => Rgb): Picture {
  const pixels = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) pixels.set([...at(x, y), 255], (y * width + x) * 4);
  }

  return { pixels, width, height };
}

/** The pixel at (x, y), as RGBA. */
function pixelAt({ pixels, width }: Picture, x: number, y: number) {
  const at = (y * width + x) * 4;

  return { r: pixels[at]!, g: pixels[at + 1]!, b: pixels[at + 2]!, a: pixels[at + 3]! };
}

const WHITE: Rgb = [255, 255, 255];
const RED: Rgb = [200, 30, 30];
const GREEN: Rgb = [51, 102, 64];
const CREAM: Rgb = [255, 254, 247];

/** Whether (x, y) lies in the square from `from` to `to`, both included. */
const inSquare = (x: number, y: number, from: number, to: number) =>
  x >= from && x <= to && y >= from && y <= to;

describe("cutOutBackground", () => {
  it("makes the flat background see-through and keeps a patch of its colour inside the artwork", () => {
    // A red ring around a white middle that never touches the edge.
    const ring = picture(9, 9, (x, y) =>
      inSquare(x, y, 2, 6) && !(x === 4 && y === 4) ? RED : WHITE
    );

    expect(cutOutBackground(ring.pixels, ring.width, ring.height)).toBe(true);
    expect(pixelAt(ring, 0, 0).a).toBe(0);
    expect(pixelAt(ring, 2, 2).a).toBe(255);
    expect(pixelAt(ring, 4, 4)).toEqual({ r: 255, g: 255, b: 255, a: 255 });
  });

  it("leaves a picture whose border is not one flat colour alone", () => {
    const halves = picture(8, 8, (x) => (x < 4 ? RED : WHITE));

    expect(cutOutBackground(halves.pixels, halves.width, halves.height)).toBe(false);
    expect(pixelAt(halves, 0, 0).a).toBe(255);
    expect(pixelAt(halves, 7, 7).a).toBe(255);
  });

  it("takes a noisier background as flat at a looser tolerance", () => {
    // A background of two shades of white, 81 apart: two colours by default.
    const noisy = picture(8, 8, (x, y) =>
      inSquare(x, y, 3, 4) ? RED : (x + y) % 2 ? WHITE : [208, 208, 208]
    );

    expect(cutOutBackground(noisy.pixels, noisy.width, noisy.height)).toBe(false);
    expect(cutOutBackground(noisy.pixels, noisy.width, noisy.height, 90)).toBe(true);
    expect(pixelAt(noisy, 0, 0).a).toBe(0);
    expect(pixelAt(noisy, 3, 3).a).toBe(255);
  });
});

describe("defringe", () => {
  /** A red square on white whose outer line is the pale mix a smooth edge leaves. */
  function fringedSquare(): Picture {
    const square = picture(10, 10, (x, y) => {
      if (inSquare(x, y, 3, 6)) return RED;

      return inSquare(x, y, 2, 7) ? [240, 160, 160] : WHITE;
    });

    cutOutBackground(square.pixels, square.width, square.height);

    return square;
  }

  it("trims the mixed line along the edge to a faint feather in the artwork's colour", () => {
    const square = fringedSquare();

    expect(pixelAt(square, 2, 4).a).toBe(255);
    defringe(square.pixels, square.width, square.height);

    const fringe = pixelAt(square, 2, 4);

    expect(fringe.a).toBeGreaterThan(0);
    expect(fringe.a).toBeLessThan(64);
    expect([fringe.r, fringe.g, fringe.b]).toEqual([...RED]);
  });

  it("feathers the new edge and leaves the artwork's middle and the background as they were", () => {
    const square = fringedSquare();

    defringe(square.pixels, square.width, square.height);

    const edge = pixelAt(square, 3, 4);

    expect(edge.a).toBeGreaterThan(191);
    expect(edge.a).toBeLessThan(255);
    expect([edge.r, edge.g, edge.b]).toEqual([...RED]);
    expect(pixelAt(square, 4, 4).a).toBe(255);
    expect(pixelAt(square, 1, 4).a).toBe(0);
    expect(pixelAt(square, 0, 0).a).toBe(0);
  });

  it("keeps artwork that runs off the picture's edge solid up to that edge", () => {
    const strip = picture(6, 4, () => RED);

    for (let y = 0; y < strip.height; y++) strip.pixels[y * strip.width * 4 + 3] = 0;
    defringe(strip.pixels, strip.width, strip.height);

    expect(pixelAt(strip, 5, 0).a).toBe(255);
    expect(pixelAt(strip, 5, 3).a).toBe(255);
    expect(pixelAt(strip, 1, 1).a).toBeLessThan(255);
  });
});

describe("cutOutMark", () => {
  /** A cream square on green, one pixel beside it half cream and half green. */
  function mark(): Picture {
    return picture(8, 8, (x, y) => {
      if (inSquare(x, y, 2, 5)) return CREAM;

      return x === 6 && y === 3 ? [153, 178, 156] : GREEN;
    });
  }

  it("makes the background clear, the mark solid and an edge as opaque as it is mark", () => {
    const logo = mark();

    expect(cutOutMark(logo.pixels, logo.width, logo.height)).toEqual({
      background: GREEN,
      mark: CREAM,
    });
    expect(pixelAt(logo, 0, 0).a).toBe(0);
    expect(pixelAt(logo, 3, 3).a).toBe(255);
    expect(pixelAt(logo, 6, 3).a).toBeGreaterThan(120);
    expect(pixelAt(logo, 6, 3).a).toBeLessThan(136);
  });

  it("paints every pixel the mark's colour, so no edge keeps the old background", () => {
    const logo = mark();

    cutOutMark(logo.pixels, logo.width, logo.height);

    for (const [x, y] of [
      [0, 0],
      [3, 3],
      [6, 3],
    ] as const) {
      const { r, g, b } = pixelAt(logo, x, y);

      expect([r, g, b]).toEqual([...CREAM]);
    }
  });

  it("makes a hole in the mark see-through too", () => {
    const ring = picture(9, 9, (x, y) =>
      inSquare(x, y, 2, 6) && !inSquare(x, y, 4, 4) ? CREAM : GREEN
    );

    cutOutMark(ring.pixels, ring.width, ring.height);

    expect(pixelAt(ring, 4, 4).a).toBe(0);
    expect(pixelAt(ring, 2, 2).a).toBe(255);
  });

  it("paints the mark the colour asked for", () => {
    const logo = mark();

    expect(cutOutMark(logo.pixels, logo.width, logo.height, { color: [0, 0, 0] })?.mark).toEqual(
      CREAM
    );
    expect(pixelAt(logo, 3, 3)).toEqual({ r: 0, g: 0, b: 0, a: 255 });
    expect(pixelAt(logo, 0, 0).a).toBe(0);
  });

  it("finds the mark's colour by its body, not by a stray pixel further from the background", () => {
    const speck = picture(8, 8, (x, y) => {
      if (x === 6 && y === 6) return [0, 0, 0];

      return inSquare(x, y, 2, 4) ? RED : WHITE;
    });

    expect(cutOutMark(speck.pixels, speck.width, speck.height)?.mark).toEqual(RED);
    expect(pixelAt(speck, 3, 3).a).toBe(255);
  });

  it("leaves a picture whose border is not one flat colour alone", () => {
    const halves = picture(8, 8, (x) => (x < 4 ? CREAM : GREEN));

    expect(cutOutMark(halves.pixels, halves.width, halves.height)).toBeNull();
    expect(pixelAt(halves, 0, 0)).toEqual({ r: 255, g: 254, b: 247, a: 255 });
  });

  it("makes a picture of nothing but its background wholly see-through", () => {
    const blank = picture(4, 4, () => GREEN);

    expect(cutOutMark(blank.pixels, blank.width, blank.height)).toEqual({
      background: GREEN,
      mark: GREEN,
    });
    expect(pixelAt(blank, 1, 1).a).toBe(0);
  });
});
