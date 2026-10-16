import * as http from "http";
import * as path from "path";
import type { AddressInfo } from "net";

// Obtained at runtime so Next's file tracing does not treat served paths as build assets
// (a dynamic fs path makes Turbopack try to include the whole project, incl. out/ and .venv symlinks).
const fs = process.getBuiltinModule("node:fs") as typeof import("fs");

const TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
};

/**
 * Minimal read-only static server so local Remotion renders can load images and audio
 * over http (the same shape as Lambda, which needs absolute URLs).
 * Mounts: { "/assets": "/abs/dir", "/music": "/abs/public/music" }. Bound to 127.0.0.1.
 */
export async function startStaticServer(mounts: Record<string, string>): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const roots = Object.entries(mounts).map(([prefix, dir]) => [prefix.replace(/\/$/, ""), path.resolve(/* turbopackIgnore: true */ dir)] as const);
  const server = http.createServer((req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      const pathname = decodeURIComponent(url.pathname);
      const mount = roots.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`));
      if (!mount) {
        res.writeHead(404).end();
        return;
      }
      const [prefix, root] = mount;
      const file = path.resolve(/* turbopackIgnore: true */ root, `.${pathname.slice(prefix.length)}`);
      if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
        res.writeHead(404).end();
        return;
      }
      const stat = fs.statSync(file);
      const type = TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream";
      const range = req.headers.range;
      const headers = { "Content-Type": type, "Accept-Ranges": "bytes", "Access-Control-Allow-Origin": "*" };
      if (range) {
        const m = /bytes=(\d*)-(\d*)/.exec(range);
        const start = m && m[1] ? Number(m[1]) : 0;
        const end = m && m[2] ? Math.min(Number(m[2]), stat.size - 1) : stat.size - 1;
        res.writeHead(206, { ...headers, "Content-Range": `bytes ${start}-${end}/${stat.size}`, "Content-Length": end - start + 1 });
        fs.createReadStream(file, { start, end }).pipe(res);
        return;
      }
      res.writeHead(200, { ...headers, "Content-Length": stat.size });
      fs.createReadStream(file).pipe(res);
    } catch {
      res.writeHead(500).end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
