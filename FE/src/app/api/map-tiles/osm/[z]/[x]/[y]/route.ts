export async function GET(
    _request: Request,
    context: { params: Promise<{ z: string; x: string; y: string }> }
) {
    const { z, x, y } = await context.params;
    const tileUrl = `https://tile.openstreetmap.org/${encodeURIComponent(z)}/${encodeURIComponent(x)}/${encodeURIComponent(y)}.png`;
    const response = await fetch(tileUrl, {
        headers: {
            "User-Agent": "GIS-ASXH/1.0",
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
