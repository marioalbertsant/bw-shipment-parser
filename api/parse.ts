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

    const { text, fileUrl } = req.query as {
      text?: string;
      fileUrl?: string;
    };

    let rawText: string | undefined;

    if (text && typeof text === "string") {
      // Cenário principal: texto vem directamente na query (?text=...)
      rawText = decodeURIComponent(text);
    } else if (fileUrl && typeof fileUrl === "string") {
      // Fallback opcional: ler texto de um URL externo (sujeito a auth/403)
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

/**
 * Parser “inteligente” para assignment list 4flow:
 * - ancora em todas as ocorrências LxWxH
 * - antes de cada LxWxH:
 *    - último “… kg” = peso
 *    - último “Air Freight <n>” ou “<n> PAL_” = Pieces
 * - depois de cada LxWxH:
 *    - primeiro “… m³” = volume
 */
function parseShipmentDetails(text: string): ShipmentRow[] {
  const rows: ShipmentRow[] = [];

  // 1) Encontrar todas as dimensões LxWxH no texto
  const dimRegex = /(\d+[,\.]\d+)x(\d+[,\.]\d+)x(\d+[,\.]\d+)/g;

  const matches: {
    index: number;
    length: number;
    Ls: string;
    Ws: string;
    Hs: string;
  }[] = [];

  let m: RegExpExecArray | null;
  while ((m = dimRegex.exec(text)) !== null) {
    matches.push({
      index: m.index,
      length: m[0].length,
      Ls: m[1],
      Ws: m[2],
      Hs: m[3]
    });
  }

  // 2) Para cada conjunto de dimensões, olhar para o contexto à volta
  for (let i = 0; i < matches.length; i++) {
    const dim = matches[i];

    // Janela de contexto (ajusta se for preciso mais/menos)
    const WINDOW_BEFORE = 800;
    const WINDOW_AFTER = 200;

    const start = Math.max(0, dim.index - WINDOW_BEFORE);
    const end = Math.min(text.length, dim.index + dim.length + WINDOW_AFTER);
    const window = text.slice(start, end);

    const offset = dim.index - start; // posição das dims dentro da janela

    const beforeDims = window.slice(0, offset);
    const afterDims = window.slice(offset);

    // 2.1 Volume – primeiro “… m³” depois das dimensões
    let cbm = 0;
    const volMatch = afterDims.match(/(\d+[,\.]\d+)\s*m³/);
    if (volMatch) {
      cbm = parseFloat(volMatch[1].replace(",", "."));
    }

    // 2.2 Peso – último “… kg” antes das dimensões
    let weight = 0;
    const weightMatches = [...beforeDims.matchAll(/(\d+[,\.]\d+)\s*kg/g)];
    if (weightMatches.length > 0) {
      const last = weightMatches[weightMatches.length - 1];
      weight = parseFloat(last[1].replace(",", "."));
    }

    // 2.3 Pieces – último marcador de quantidade antes das dimensões:
    //    - “Air Freight <n>”
    //    - “<n> PAL_…”
    let pieces = 1;
    let lastMarkerIndex = -1;

    const airRegex = /Air Freight\s+(\d+)/g;
    let ma: RegExpExecArray | null;
    while ((ma = airRegex.exec(beforeDims)) !== null) {
      if (ma.index > lastMarkerIndex) {
        lastMarkerIndex = ma.index;
        pieces = parseInt(ma[1], 10);
      }
    }

    const palRegex = /(\d+)\s+PAL_/g;
    let mp: RegExpExecArray | null;
    while ((mp = palRegex.exec(beforeDims)) !== null) {
      if (mp.index > lastMarkerIndex) {
        lastMarkerIndex = mp.index;
        pieces = parseInt(mp[1], 10);
      }
    }

    rows.push({
      ID: i + 1,
      Pieces: pieces,
      Length: Math.round(parseFloat(dim.Ls.replace(",", ".")) * 100),
      Width: Math.round(parseFloat(dim.Ws.replace(",", ".")) * 100),
      Height: Math.round(parseFloat(dim.Hs.replace(",", ".")) * 100),
      Weight: weight,
      CBM: cbm,
      Stackable: ""
    });
  }

  return rows;
}
