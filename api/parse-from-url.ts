// api/parse-from-url.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  try {
    const fileUrlParam = req.query.fileUrl;
    const fileUrl = Array.isArray(fileUrlParam) ? fileUrlParam[0] : fileUrlParam;

    if (!fileUrl) {
      res.status(400).json({ error: 'Missing "fileUrl"' });
      return;
    }

    console.log('parse-from-url TEST: downloading from', fileUrl);

    const response = await fetch(fileUrl);
    const raw = await response.text();

    res.status(200).json({
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      length: raw.length,
      sample: raw.slice(0, 400)
    });
  } catch (err: any) {
    console.error('TEST handler error:', err);
    res.status(500).json({
      error: 'Test handler failed',
      message: err?.message ?? String(err)
    });
  }
}
