import { requireAuth } from "@/lib/auth-helpers";

const IMAGE_SOURCES: Record<string, string> = {
  "media.daft.ie": "https://www.daft.ie/",
};

export async function GET(request: Request) {
  const { error } = await requireAuth();
  if (error) return error;

  const source = new URL(request.url).searchParams.get("url");
  if (!source) {
    return Response.json({ error: "Missing image URL." }, { status: 400 });
  }

  let imageUrl: URL;
  try {
    imageUrl = new URL(source);
  } catch {
    return Response.json({ error: "Invalid image URL." }, { status: 400 });
  }

  const referer = IMAGE_SOURCES[imageUrl.hostname];
  if (imageUrl.protocol !== "https:" || !referer) {
    return Response.json({ error: "Image source is not allowed." }, { status: 403 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(imageUrl, {
      headers: {
        Referer: referer,
        "User-Agent": "Mozilla/5.0 (compatible; PropAtlas/1.0)",
      },
    });
  } catch {
    return Response.json({ error: "Image could not be loaded." }, { status: 502 });
  }
  const contentType = upstream.headers.get("content-type") || "";

  if (!upstream.ok || !contentType.startsWith("image/")) {
    return Response.json({ error: "Image could not be loaded." }, { status: 502 });
  }

  const image = await upstream.arrayBuffer();
  if (image.byteLength > 10 * 1024 * 1024) {
    return Response.json({ error: "Image is too large." }, { status: 413 });
  }

  return new Response(image, {
    headers: {
      "Cache-Control": "private, max-age=86400",
      "Content-Type": contentType,
    },
  });
}
