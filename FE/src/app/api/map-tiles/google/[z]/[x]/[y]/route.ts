const allowedLayers = new Set(["m", "s", "y", "p"]);

export async function GET(
    request: Request,
    context: { params: Promise<{ z: string; x: string; y: string }> }
) {
    const { z, x, y } = await context.params;
    const { searchParams } = new URL(request.url);
    const layer = searchParams.get("lyrs") ?? "m";
    const safeLayer = allowedLayers.has(layer) ? layer : "m";

    const tileUrl = `https://mt1.google.com/vt/lyrs=${safeLayer}&x=${encodeURIComponent(x)}&y=${encodeURIComponent(y)}&z=${encodeURIComponent(z)}`;
    const response = await fetch(tileUrl, {
        headers: {
            "User-Agent": "Mozilla/5.0",
        },
        next: { revalidate: 60 * 60 * 24 * 7 },
    });

    if (!response.ok || !response.body) {
        return new Response("Tile not found", { status: response.status || 404 });
    }

    return new Response(response.body, {
        status: 200,
        headers: {
            "Content-Type": response.headers.get("content-type") ?? "image/png",
            "Cache-Control": "public, max-age=604800, stale-while-revalidate=86400",
            "Access-Control-Allow-Origin": "*",
        },
    });
}
