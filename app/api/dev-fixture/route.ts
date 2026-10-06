// DEVELOPMENT ONLY: serves a test lecture fixture for the ?devfeed option.
// Returns 404 in production builds.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (process.env.NODE_ENV !== "development") return new Response("Not found", { status: 404 });

  const name = new URL(request.url).searchParams.get("name") ?? "";
  if (!/^[a-z0-9-]+$/.test(name)) return new Response("Bad name", { status: 400 });

  const dir = path.join(process.cwd(), "fixtures", "lectures");
  const file = (await readdir(dir)).find((f) => f.startsWith(name) && f.endsWith(".txt"));
  if (!file) return new Response("Not found", { status: 404 });

  return new Response(await readFile(path.join(dir, file), "utf8"), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
