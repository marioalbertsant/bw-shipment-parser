export default async function handler(req: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(req.url);
    const fileUrl = searchParams.get("fileUrl");
    if (!fileUrl) {
      return new Response(JSON.stringify({ error: "Missing fileUrl parameter" }), { status: 400 });
    }

    const fileResponse = await fetch(fileUrl);
    if (!fileResponse.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to download file", status: fileResponse.status }),
        { status: 502 }
      );
    }

    const text = await fileResponse.text();

    // Aqui reutilizas a tua função existente
    const result = parseShipment(text);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500 });
  }
}
