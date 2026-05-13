// api/parse-from-url.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { parseShipment } from '../lib/parseShipment.js';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  try {
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed. Use GET.' });
      return;
    }

    const fileUrlParam = req.query.fileUrl;
    const fileUrl = Array.isArray(fileUrlParam) ? fileUrlParam[0] : fileUrlParam;

    if (!fileUrl || typeof fileUrl !== 'string') {
      res.status(400).json({ error: 'Missing "fileUrl" query parameter.' });
      return;
    }

    const response = await fetch(fileUrl, { redirect: 'follow' });

    if (!response.ok) {
      res.status(502).json({
        error: 'Failed to download file.',
        status: response.status,
        statusText: response.statusText,
      });
      return;
    }

    const text = await response.text();

    if (!text?.trim()) {
      res.status(422).json({ error: 'Downloaded file is empty.' });
      return;
    }

    const result = parseShipment(text);

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(result);
  } catch (err: any) {
    console.error('Error in /api/parse-from-url:', err);
    res.status(500).json({
      error: 'Internal server error.',
      message: err?.message ?? 'Unknown error',
    });
  }
}
