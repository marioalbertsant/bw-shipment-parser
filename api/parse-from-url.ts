// api/parse-from-url.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { parseShipment } from '../lib/parseShipment';

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

    const fileUrlParam = req.query.fileUrl;
    const fileUrl = Array.isArray(fileUrlParam) ? fileUrlParam[0] : fileUrlParam;

    if (!fileUrl) {
      res.status(400).json({
        error: 'Missing "fileUrl" query parameter.'
      });
      return;
    }

    // Vai buscar o conteúdo do ficheiro (txt) ao OneDrive/SharePoint
    const response = await fetch(fileUrl);

    if (!response.ok) {
      res.status(502).json({
        error: 'Failed to download file from fileUrl.',
        status: response.status,
        statusText: response.statusText
      });
      return;
    }

    const text = await response.text();

    const result = parseShipment(text);

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, must-revalidate, max-age=0');
    res.status(200).json(result);
  } catch (err: any) {
    console.error('Error in /api/parse-from-url:', err);
    res.status(500).json({
      error: 'Internal server error.',
      message: err?.message ?? 'Unknown error'
    });
  }
}
