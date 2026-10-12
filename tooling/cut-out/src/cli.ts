/**
 * Make the flat background of a picture see-through (README.md says which
 * way suits which picture):
 *
 *   pnpm --filter @norish/cut-out-tool cut-out <picture> [<output>] [--mark] [--color <hex>] [--tolerance <n>]
 *
 * Paths are taken from where the command was run. The output defaults to the
 * picture's name with `.cut-out.png`, beside it; one ending in `.webp` is
 * written as lossless WebP. The picture itself is never changed.
 */
import { readFile, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import { parseArgs } from "node:util";

import type { Format } from "./cut-out";
import { cutOut, hex, parseColor } from "./cut-out";

const USAGE =
  "Usage: pnpm --filter @norish/cut-out-tool cut-out <picture> [<output>] [--mark] [--color <hex>] [--tolerance <n>]";

function say(text: string): void {
  process.stdout.write(`${text}\n`);
}

/** The format an output's extension asks for. */
function formatOf(path: string): Format {
  const extension = extname(path).toLowerCase();

  if (extension === ".png") return "png";
  if (extension === ".webp") return "webp";
  throw new Error(`The output is written as PNG or WebP, so it ends in .png or .webp: ${path}`);
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      mark: { type: "boolean" },
      color: { type: "string" },
      tolerance: { type: "string" },
    },
  });
  const [picture, output, ...extra] = positionals;

  if (!picture || extra.length > 0) throw new Error(USAGE);

  const color = values.color === undefined ? undefined : parseColor(values.color);
  const tolerance = values.tolerance === undefined ? undefined : Number(values.tolerance);

  if (color === null) throw new Error(`Not a colour: ${values.color} (give it as #rrggbb)`);
  if (color && !values.mark) throw new Error("--color paints a mark, so it goes with --mark");
  if (tolerance !== undefined && !(tolerance >= 0)) {
    throw new Error(`The tolerance is a distance in RGB, 0 or more: ${values.tolerance}`);
  }

  // pnpm runs the script inside this workspace; INIT_CWD is where the command was typed.
  const from = process.env.INIT_CWD ?? process.cwd();
  const input = resolve(from, picture);
  const target = output
    ? resolve(from, output)
    : join(dirname(input), `${basename(input, extname(input))}.cut-out.png`);

  if (target === input) throw new Error("The output would overwrite the picture");

  const { bytes, colors } = await cutOut(await readFile(input), {
    mark: values.mark,
    color,
    tolerance,
    format: formatOf(target),
  });

  await writeFile(target, bytes);
  say(
    colors
      ? `Cut a ${hex(colors.mark)} mark out of its ${hex(colors.background)} background${color ? `, painted ${hex(color)}` : ""}: ${target}`
      : `Cut the background away: ${target}`
  );
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
