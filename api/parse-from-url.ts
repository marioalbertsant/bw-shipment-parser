// api/parse-from-url.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { parseShipment } from '../lib/parseShipment';

function normalizeGoogleDriveUrl(input: string): string {
  const url = input.trim();

  if (/drive\.google\.com\/uc\?/.test(url)) {
    return url;
  }

  const fileMatch = url.match(/drive\.google\.com\/file\/d\/([^/]+)/i);
  if (fileMatch?.[1]) {
    return `https://drive.google.com/uc?export=download&id=${fileMatch[1]}`;
  }

  const openMatch = url.match(/[?&]id=([^&]+)/i);
  if (openMatch?.[1]) {
    return `https://drive.google.com/uc?export=download&id=${openMatch[1]}`;
  }

  return url;
}

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
    const fileUrlRaw = Array.isArray(fileUrlParam) ? fileUrlParam[0] : fileUrlParam;

    if (!fileUrlRaw || typeof fileUrlRaw !== 'string') {
      res.status(400).json({
        error: 'Missing "fileUrl" query parameter.'
      });
      return;
    }

    const fileUrl = normalizeGoogleDriveUrl(fileUrlRaw);

    const response = await fetch(fileUrl, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'bw-shipment-parser/1.0',
        Accept: 'text/plain,text/html;q=0.9,*/*;q=0.8'
      }
    });

    if (!response.ok) {
      res.status(502).json({
        error: 'Failed to download file from fileUrl.',
        status: response.status,
        statusText: response.statusText,
        fileUrl
      });
      return;
    }

    const text = await response.text();

    if (!text || !text.trim()) {
      res.status(422).json({
        error: 'Downloaded file is empty.',
        fileUrl
      });
      return;
    }

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
