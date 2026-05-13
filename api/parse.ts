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

type ShipmentResponse = {
  transportOrder: string | null;
  totalPieces: number;
  totalGrossWeight: number | null;
  totalCBM: number | null;
  consignor: string | null;
  recipient: string | null;
  shipmentDetails: ShipmentRow[];
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { text, fileUrl } = req.query as { text?: string; fileUrl?: string };
    let rawText: string | undefined;

    if (text && typeof text === "string") {
      rawText = decodeURIComponent(text);
    } else if (fileUrl && typeof fileUrl === "string") {
      const resp = await fetch(fileUrl);
      if (!resp.ok) {
        return res.status(502).json({ error: "Failed to download input file", status: resp.status });
      }
      rawText = await resp.text();
    } else {
      return res.status(400).json({ error: "Missing 'text' or 'fileUrl' query parameter" });
    }

    const shipment = parseShipment(rawText);
    return res.status(200).json(shipment);
  } catch (err) {
    console.error("Parser error", err);
    return res.status(500).json({ error: "Parser error" });
  }
}

function parseNum(s: string): number {
  return parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0;
}

function parseShipment(text: string): ShipmentResponse {
  const shipmentDetails = parseShipmentDetails(text);

  // Transport Order
  let transportOrder: string | null = null;
  const toMatch = text.match(/\b(1\d{7})\b/);
  if (toMatch) transportOrder = toMatch[1];

  // Totais
  let totalGrossWeight: number | null = null;
  let totalCBM: number | null = null;

  const swM = text.match(/Sum weight:\s*([\d.,]+)\s*kg/i);
  if (swM) totalGrossWeight = parseNum(swM[1]);

  const svM = text.match(/Sum volume:\s*([\d.,]+)\s*m/i);
  if (svM) totalCBM = parseNum(svM[1]);

  // Consignor
  let consignor: string | null = null;
  const cM = text.match(/Consignor:\s+([\s\S]+?)(?=\(ID:)/i);
  if (cM) consignor = cM[1].trim().replace(/;$/, "").trim();

  // Recipient
  let recipient: string | null = null;
  const rM = text.match(/Recipient:\s+([\s\S]+?)(?=\(ID:)/i);
  if (rM) recipient = rM[1].trim().replace(/;$/, "").trim();

  const totalPieces = shipmentDetails.reduce((acc, row) => acc + row.Pieces, 0);

  return { transportOrder, totalPieces, totalGrossWeight, totalCBM, consignor, recipient, shipmentDetails };
}

function parseShipmentDetails(text: string): ShipmentRow[] {
  const rows: ShipmentRow[] = [];

  // Match: LxWxH m <stackability> <CBM> m³  (dimensões em metros)
  const dimRegex = /(\d+[,.]\d+)\s*x\s*(\d+[,.]\d+)\s*x\s*(\d+[,.]\d+)\s*m\s+(\d{1,3}|999)\s+([\d,.]+)\s*m³/g;

  let m: RegExpExecArray | null;
  let id = 0;

  while ((m = dimRegex.exec(text)) !== null) {
    id++;
    const L = parseNum(m[1]);
    const W = parseNum(m[2]);
    const H = parseNum(m[3]);
    const stackable = m[4];
    const cbm = parseNum(m[5]);

    // Janela de contexto antes das dimensões
    const before = text.slice(Math.max(0, m.index - 600), m.index);

    // Peso — último "… kg" antes das dimensões
    let weight = 0;
    const weightMatches = [...before.matchAll(/(\d+[,.]\d*)\s*kg/g)];
    if (weightMatches.length > 0) {
      weight = parseNum(weightMatches[weightMatches.length - 1][1]);
    }

    // Pieces — último marcador antes das dimensões
    // Prioridade: "<n> PAL_" ou "MISC handling unit" precedido de "<n>"
    let pieces = 1;
    let lastIdx = -1;

    // "<n> PAL_EUR / PAL_EURO / PAL_INDU"
    const palMatches = [...before.matchAll(/(?<!\d)(\d{1,3})\s+PAL_/g)];
    for (const pm of palMatches) {
      if ((pm.index ?? 0) > lastIdx) {
        lastIdx = pm.index ?? 0;
        pieces = parseInt(pm[1], 10);
      }
    }

    // "<n> MISC handling unit"
    const miscMatches = [...before.matchAll(/(?<!\d)(\d{1,3})\s+MISC handling unit/gi)];
    for (const mm of miscMatches) {
      if ((mm.index ?? 0) > lastIdx) {
        lastIdx = mm.index ?? 0;
        pieces = parseInt(mm[1], 10);
      }
    }

    rows.push({
      ID: id,
      Pieces: pieces,        // ← minúsculo: variável local; maiúsculo: propriedade do tipo
      Length: Math.round(L * 100),
      Width: Math.round(W * 100),
      Height: Math.round(H * 100),
      Weight: weight,
      CBM: cbm,
      Stackable: stackable,
    });
  }

  return rows;
}
