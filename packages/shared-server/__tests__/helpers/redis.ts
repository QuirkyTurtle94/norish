import { readFileSync } from "node:fs";

/**
 * The Redis image docker/compose.base.yaml ships. Every test that runs against
 * a real Redis starts this one, read from the compose file so the two cannot
 * drift apart.
 */
export const REDIS_IMAGE = composeRedisImage();

function composeRedisImage(): string {
  const compose = readFileSync(
    new URL("../../../../docker/compose.base.yaml", import.meta.url),
    "utf8"
  );
  const image = /^\s*image:\s*(redis:\S+)\s*$/m.exec(compose)?.[1];

  if (!image) throw new Error("docker/compose.base.yaml names no Redis image");

  return image;
}
