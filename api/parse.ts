// api/parse.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

type ShipmentDetail = {
  ID: number;
  Pieces: number;
  Length: number;
  Width: number;
  Height: number;
  Weight: number;
  CBM: number;
  Stackable: string;
};

type ParseResult = {
  transportOrder: string;
  totalPieces: number;
  totalGrossWeight: number;
  totalCBM: number;
  consignor: string;
  recipient: string;
  shipmentDetails: ShipmentDetail[];
};

/**
 * AQUI ficas com o mesmo parser que já tinhas.
 * Basta colar a tua lógica actual dentro desta função
 * (regex, splits, etc.) e garantir que devolve o mesmo JSON.
 */
function parseShipment(text: string): ParseResult {
  // TODO: substituir por implementação real que já tens
  // O exemplo abaixo é apenas um "stub" para compilar.
  return {
    transportOrder: '',
    totalPieces: 0,
    totalGrossWeight: 0,
    totalCBM: 0,
    consignor: '',
    recipient: '',
    shipmentDetails: []
  };
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  try {
    if (req.method !== 'GET') {
      res
        .status(405)
        .json({ error: 'Method not allowed. Use GET.' });
      return;
    }

    // Query params podem vir como string | string[]
    const textParam = req.query.text;
    const fileUrlParam = req.query.fileUrl;

    const text = Array.isArray(textParam) ? textParam[0] : textParam;
    const fileUrl = Array.isArray(fileUrlParam) ? fileUrlParam[0] : fileUrlParam;

    if (!text && !fileUrl) {
      res.status(400).json({
        error: 'Missing parameter. Provide either "text" or "fileUrl".'
      });
      return;
    }

    let shipmentText: string;

    if (fileUrl) {
      // Quando vem fileUrl (cenário Power Automate + OneDrive/SharePoint)
      const response = await fetch(fileUrl);

      if (!response.ok) {
        res.status(502).json({
          error: 'Failed to download file from fileUrl.',
          status: response.status,
          statusText: response.statusText
        });
        return;
      }

      shipmentText = await response.text();
    } else {
      // Cenário original: texto vem directamente no query string
      shipmentText = text as string;
    }

    const result = parseShipment(shipmentText);

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, must-revalidate, max-age=0');
    res.status(200).json(result);
  } catch (err: any) {
    console.error('Error in /api/parse:', err);
    res.status(500).json({
      error: 'Internal server error.',
      message: err?.message ?? 'Unknown error'
    });
  }
}
