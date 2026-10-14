import { readFileSync } from "node:fs";
import { connect, createServer } from "node:net";
import type { AddressInfo, Socket } from "node:net";

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

/**
 * A TCP proxy to Redis whose open connections can be frozen: they stay open
 * and forward nothing, as a connection does when Redis restarts behind
 * Docker's port forwarding. Connections made after a freeze work normally.
 */
export function freezableProxy(target: { host: string; port: number }) {
  const open: [Socket, Socket][] = [];
  const all: Socket[] = [];
  const server = createServer((client) => {
    const upstream = connect(target.port, target.host);

    for (const socket of [client, upstream]) {
      socket.on("error", () => {});
      all.push(socket);
    }
    client.pipe(upstream);
    upstream.pipe(client);
    open.push([client, upstream]);
  });

  return {
    /** Listens on a free local port and resolves to its Redis URL. */
    listen: () =>
      new Promise<string>((resolve) => {
        server.listen(0, "127.0.0.1", () => {
          resolve(`redis://127.0.0.1:${(server.address() as AddressInfo).port}`);
        });
      }),
    freeze() {
      for (const [client, upstream] of open.splice(0)) {
        client.unpipe(upstream);
        upstream.unpipe(client);
        client.pause();
        upstream.pause();
      }
    },
    close: () =>
      new Promise<void>((resolve) => {
        for (const socket of all) socket.destroy();
        server.close(() => resolve());
      }),
  };
}
