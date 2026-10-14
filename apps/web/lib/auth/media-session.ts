import { NextResponse } from "next/server";

import { readSessionPrincipal } from "@norish/auth/session";

/**
 * The session check of a signed-in media route: a request without a session
 * is answered as if the file were missing, and the answer is not cached. It
 * reads the session alone, with no database lookup, so a grid of images costs
 * none.
 */
export async function refuseWithoutSession(req: Request): Promise<Response | null> {
  const principal = await readSessionPrincipal(req.headers).catch(() => null);

  return principal
    ? null
    : NextResponse.json(
        { error: "Not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
}
