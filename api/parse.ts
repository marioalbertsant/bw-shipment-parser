import type { VercelRequest, VercelResponse } from "@vercel/node";

type ShipmentRow = {
  ID: number;
  Pieces: number;
  Length: number;
  Width: number;
  Height: number;
  Weight: number;
  CBM: number;
  Stackable: string;
};

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { text, fileUrl } = req.query as {
      text?: string;
      fileUrl?: string;
    };

    let rawText: string | undefined;

    if (text && typeof text === "string") {
      // Caso principal: texto vem directamente na query (URI encoded)
      rawText = decodeURIComponent(text);
    } else if (fileUrl && typeof fileUrl === "string") {
      // Fallback opcional: tentar ler de um URL externo (sujeito a 403 se exigir auth)
      const resp = await fetch(fileUrl);
      if (!resp.ok) {
        return res.status(502).json({
          error: "Failed to download input file",
          status: resp.status
        });
      }
      rawText = await resp.text();
    } else {
      return res.status(400).json({
        error: "Missing 'text' (preferred) or 'fileUrl' query parameter"
      });
    }

    const shipmentDetails = parseShipmentDetails(rawText);
    return res.status(200).json(shipmentDetails);
  } catch (err) {
    console.error("Parser error", err);
    return res.status(500).json({ error: "Parser error" });
  }
}

function parseShipmentDetails(text: string): ShipmentRow[] {
  const rows: ShipmentRow[] = [];

  const startIdx = text.indexOf("Standard");
  const endIdx = text.indexOf("Sum volume:");
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) return rows;

  const segment = text.slice(startIdx, endIdx);

  const rawBlocks = segment
    .split("m³")
    .map((b) => b.trim())
    .filter((b) => b && b.includes("kg"));

  rawBlocks.forEach((block, idx) => {
    const dimMatch = block.match(
      /(\d+[,\.]\d+)x(\d+[,\.]\d+)x(\d+[,\.]\d+)/
    );
    if (!dimMatch) return;
    const [, Ls, Ws, Hs] = dimMatch;

    const allNums = block.match(/\d+[,\.]\d+/g) || [];
    if (!allNums.length) return;
    const cbmStr = allNums[allNums.length - 1];

    const wtMatch = block.match(/(\d+[,\.]\d+)\s*kg/);
    const wtStr = wtMatch ? wtMatch[1] : "0";

    let pieces = 1;
    if (block.includes("Air Freight")) {
      const after = block
        .split("Air Freight")[1]
        ?.trim()
        .split(/\s+/)[0];
      const p = parseInt(after ?? "1", 10);
      if (!Number.isNaN(p)) pieces = p;
    } else if (block.includes("PAL_")) {
      const beforePal = block.split("PAL_")[0];
      const tokens = beforePal.trim().split(/\s+/);
      const lastTok = tokens[tokens.length - 1];
      const p = parseInt(lastTok, 10);
      if (!Number.isNaN(p)) pieces = p;
    }

    rows.push({
      ID: idx + 1,
      Pieces: pieces,
      Length: Math.round(parseFloat(Ls.replace(",", ".")) * 100),
      Width: Math.round(parseFloat(Ws.replace(",", ".")) * 100),
      Height: Math.round(parseFloat(Hs.replace(",", ".")) * 100),
      Weight: parseFloat(wtStr.replace(",", ".")),
      CBM: parseFloat(cbmStr.replace(",", ".")),
      Stackable: ""
    });
  });

  return rows;
}
