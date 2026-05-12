import type { VercelRequest, VercelResponse } from "@vercel/node";

type ShipmentRow = {
  ID: number;
  Pieces: number;
  Length: number; // cm
  Width: number;  // cm
  Height: number; // cm
  Weight: number; // kg
  CBM: number;    // m3
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

    const fileUrl = req.query.fileUrl;
    if (!fileUrl || typeof fileUrl !== "string") {
      return res
        .status(400)
        .json({ error: "Missing or invalid 'fileUrl' query parameter" });
    }

    // 1) Ler o .txt do OneDrive
    const txtResp = await fetch(fileUrl);
    if (!txtResp.ok) {
      return res.status(502).json({
        error: "Failed to download input file",
        status: txtResp.status
      });
    }

    const text = await txtResp.text();

    // 2) Processar o texto 4flow → ShipmentDetails
    const shipmentDetails = parseShipmentDetails(text);

    return res.status(200).json(shipmentDetails);
  } catch (err) {
    console.error("Parser error", err);
    return res.status(500).json({ error: "Parser error" });
  }
}

// Core do parser – ajustável conforme fores vendo mais casos reais
function parseShipmentDetails(text: string): ShipmentRow[] {
  const rows: ShipmentRow[] = [];

  // 1) Isolar zona relevante: do primeiro 'Standard' até 'Sum volume'
  const startIdx = text.indexOf("Standard");
  const endIdx = text.indexOf("Sum volume:");
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    return rows;
  }

  const segment = text.slice(startIdx, endIdx);

  // 2) Cada HU termina com um volume '... m³'
  const rawBlocks = segment
    .split("m³")
    .map((b) => b.trim())
    .filter((b) => b && b.includes("kg")); // elimina lixo sem peso

  rawBlocks.forEach((block, idx) => {
    // 2.1) Dimensões – primeiro padrão NxNxN
    const dimMatch = block.match(
      /(\d+[,\.]\d+)x(\d+[,\.]\d+)x(\d+[,\.]\d+)/
    );
    if (!dimMatch) {
      return;
    }
    const [, Ls, Ws, Hs] = dimMatch;

    // 2.2) Volume – último número decimal do bloco
    const allNums = block.match(/\d+[,\.]\d+/g) || [];
    if (allNums.length === 0) {
      return;
    }
    const cbmStr = allNums[allNums.length - 1];

    // 2.3) Peso – número antes de 'kg'
    const wtMatch = block.match(/(\d+[,\.]\d+)\s*kg/);
    const wtStr = wtMatch ? wtMatch[1] : "0";

    // 2.4) Pieces
    let pieces = 1;

    if (block.includes("Air Freight")) {
      // Primeiro HU – após 'Air Freight'
      const after = block
        .split("Air Freight")[1]
        ?.trim()
        .split(/\s+/)[0];
      const p = parseInt(after ?? "1", 10);
      if (!Number.isNaN(p)) pieces = p;
    } else if (block.includes("PAL_")) {
      // HUs seguintes – número imediatamente antes de PAL_*
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
