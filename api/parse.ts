// api/parse.ts
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

    const textParam = req.query.text;
    const text = Array.isArray(textParam) ? textParam[0] : textParam;

    if (!text) {
      res.status(400).json({
        error: 'Missing "text" query parameter.'
      });
      return;
    }

    const result = parseShipment(text);

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
