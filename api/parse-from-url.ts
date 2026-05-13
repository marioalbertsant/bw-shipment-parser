// api/parse-from-url.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { parseShipment } from '../lib/parseShipment';

function normalizeGoogleDriveUrl(input: string): string {
  const url = input.trim();
  if (/drive\.google\.com\/uc\?/.test(url)) return url;

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

async function fetchGoogleDriveText(url: string): Promise<string> {
  const res = await fetch(url, {
    method: 'GET',
    redirect: 'follow',
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; bw-shipment-parser)',
      Accept: 'text/plain,text/html;q=0.9,*/*;q=0.8'
    }
  });

  const body = await res.text();

  // Google Drive virus-scan confirmation page
  const confirmMatch = body.match(/confirm=([0-9A-Za-z_]+)[&"]/);
  const idMatch = body.match(/id=([A-Za-z0-9_-]{20,})/);

  if (confirmMatch?.[1] && idMatch?.[1]) {
    const directUrl = `https://drive.google.com/uc?export=download&confirm=${confirmMatch[1]}&id=${idMatch[1]}`;
    const res2 = await fetch(directUrl, {
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; bw-shipment-parser)' }
    });
    return await res2.text();
  }

  return body;
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
      res.status(400).json({ error: 'Missing "fileUrl" query parameter.' });
      return;
    }

    const fileUrl = normalizeGoogleDriveUrl(fileUrlRaw);
    const text = await fetchGoogleDriveText(fileUrl);

    if (!text || !text.trim()) {
      res.status(422).json({ error: 'Downloaded file is empty.', fileUrl });
      return;
    }

    // Guardar os primeiros 200 chars no log para debug
    console.log('Fetched text preview:', text.slice(0, 200));

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
