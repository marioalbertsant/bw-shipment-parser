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

    // Log simples para veres nos logs da Vercel o URL que está a chegar
    console.log('parse-from-url: downloading from', fileUrl);

    let response: Response;
    try {
      // Em Node 18+ fetch é global; garante que o runtime está em nodejs18.x
      response = await fetch(fileUrl);
    } catch (e: any) {
      console.error('Error calling fileUrl:', e);
      res.status(502).json({
        error: 'Failed to fetch fileUrl (network or DNS error).',
        message: e?.message ?? String(e)
      });
      return;
    }

    if (!response.ok) {
      console.error('fileUrl responded with status', response.status, response.statusText);
      res.status(502).json({
        error: 'Failed to download file from fileUrl.',
        status: response.status,
        statusText: response.statusText
      });
      return;
    }

    const text = await response.text();
    console.log('parse-from-url: downloaded text length =', text.length);

    let result;
    try {
      result = parseShipment(text);
    } catch (e: any) {
      console.error('Error in parseShipment:', e);
      res.status(500).json({
        error: 'Error while parsing shipment text.',
        message: e?.message ?? String(e)
      });
      return;
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, must-revalidate, max-age=0');
    res.status(200).json(result);
  } catch (err: any) {
    console.error('UNHANDLED error in /api/parse-from-url:', err);
    res.status(500).json({
      error: 'Internal server error.',
      message: err?.message ?? 'Unknown error'
    });
  }
}
