import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)));
const port = Number.parseInt(process.env.PORT ?? "3000", 10);

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".glb", "model/gltf-binary"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".wasm", "application/wasm"],
  [".webp", "image/webp"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

function safePath(pathname) {
  const relativePath = decodeURIComponent(pathname).replace(/^\/+/, "");
  const candidate = resolve(root, relativePath || "index.html");
  if (candidate !== root && !candidate.startsWith(`${root}${sep}`)) return null;
  return candidate;
}

async function resolveFile(pathname) {
  const candidate = safePath(pathname);
  if (!candidate) return null;

  try {
    const details = await stat(candidate);
    if (details.isFile()) return { path: candidate, size: details.size };
    if (details.isDirectory()) {
      const indexPath = join(candidate, "index.html");
      const indexDetails = await stat(indexPath);
      return { path: indexPath, size: indexDetails.size };
    }
  } catch {
    // Client-side routes without a file extension fall back to the SPA shell.
  }

  if (extname(pathname)) return null;
  const indexPath = join(root, "index.html");
  const indexDetails = await stat(indexPath);
  return { path: indexPath, size: indexDetails.size };
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", "http://localhost");
    const file = await resolveFile(url.pathname);
    if (!file) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    const extension = extname(file.path).toLowerCase();
    const immutableAsset = /-[A-Za-z0-9_-]{8,}\.[^.]+$/.test(file.path);
    response.writeHead(200, {
      "Cache-Control": immutableAsset
        ? "public, max-age=31536000, immutable"
        : "no-cache",
      "Content-Length": file.size,
      "Content-Type": contentTypes.get(extension) ?? "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
    });

    if (request.method === "HEAD") {
      response.end();
      return;
    }
    createReadStream(file.path).pipe(response);
  } catch (error) {
    console.error("Static server request failed", error);
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Internal server error");
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Beat It listening on 0.0.0.0:${port}`);
});
