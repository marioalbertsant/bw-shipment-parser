// lib/parseShipment.ts

export type ShipmentDetail = {
  ID: number;
  Pieces: number;
  Length: number;
  Width: number;
  Height: number;
  Weight: number;
  CBM: number;
  Stackable: boolean;
};

export type ParseResult = {
  transportOrder: string;
  totalPieces: number;
  totalGrossWeight: number;
  totalCBM: number;
  consignor: string;
  recipient: string;
  shipmentDetails: ShipmentDetail[];
};

function parseNum(s: string): number {
  if (!s) return 0;
  const cleaned = s.trim().replace(/\./g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}

function mToCm(val: number): number {
  return Math.round(val * 100 * 100) / 100; // arredonda a 2 casas decimais
}

export function parseShipment(text: string): ParseResult {
  const normalized = text.replace(/[^\S\n]+/g, ' ').replace(/\n{3,}/g, '\n\n');

  // ── Transport Order ──────────────────────────────────────────────
  let transportOrder = '';
  const toMatch = normalized.match(/\b(1\d{7})\b/);
  if (toMatch) transportOrder = toMatch[1];

  // ── Sum totals ───────────────────────────────────────────────────
  let totalPieces = 0;
  let totalGrossWeight = 0;
  let totalCBM = 0;

  const spM = normalized.match(/Sum packaging:\s*([\d.,]+)/i);
  if (spM) totalPieces = Math.round(parseNum(spM[1]));

  const swM = normalized.match(/Sum weight:\s*([\d.,]+)\s*kg/i);
  if (swM) totalGrossWeight = parseNum(swM[1]);

  const svM = normalized.match(/Sum volume:\s*([\d.,]+)\s*m/i);
  if (svM) totalCBM = parseNum(svM[1]);

  // ── Consignor ────────────────────────────────────────────────────
  let consignor = '';
  const cM = normalized.match(/Consignor:\s+([\s\S]+?)(?=\(ID:)/i);
  if (cM) consignor = cM[1].trim().replace(/;$/, '').trim();

  // ── Recipient ────────────────────────────────────────────────────
  let recipient = '';
  const rM = normalized.match(/Recipient:\s+([\s\S]+?)(?=\(ID:)/i);
  if (rM) recipient = rM[1].trim().replace(/;$/, '').trim();

  // ── Shipment Details (HU blocks) ─────────────────────────────────
  const shipmentDetails: ShipmentDetail[] = [];
  let huId = 0;

  // Primary: match known HU type keywords with qty, weight, dims, stackability, CBM
  const huPattern =
    /(?<!\d)(\d{1,3})\s+(PAL_EURO?|PAL_INDU|MISC handling unit)[\s\S]{0,400}?(\d+[,.]?\d*)\s*kg[\s\S]{0,400}?(\d+[,.]?\d*)\s*x\s*(\d+[,.]?\d*)\s*x\s*(\d+[,.]?\d*)\s*m\s+(\d{1,3}|999)\s+([\d.,]+)\s*m³/gi;

  let hm: RegExpExecArray | null;
  while ((hm = huPattern.exec(normalized)) !== null) {
    huId++;
    shipmentDetails.push({
      ID: huId,
      Pieces: parseInt(hm[1], 10),
      Length: mToCm(parseNum(hm[4])),
      Width:  mToCm(parseNum(hm[5])),
      Height: mToCm(parseNum(hm[6])),
      Weight: parseNum(hm[3]),
      CBM:    parseNum(hm[8]),
      Stackable: hm[7].trim() === '999',
    });
  }

  // Fallback: dim-only scan for unusual HU type names
  if (shipmentDetails.length === 0) {
    const dimPattern =
      /(\d+[,.]?\d*)\s*x\s*(\d+[,.]?\d*)\s*x\s*(\d+[,.]?\d*)\s*m\s+(\d{1,3}|999)\s+([\d.,]+)\s*m³/gi;
    let dm: RegExpExecArray | null;
    while ((dm = dimPattern.exec(normalized)) !== null) {
      huId++;
      const before = normalized.slice(Math.max(0, dm.index - 300), dm.index);
      const wM = before.match(/(\d+[,.]?\d*)\s*kg\s*$/) || before.match(/(\d+[,.]?\d*)\s*kg/);
      const qM = before.match(/(?<!\d)(\d{1,3})\s+(?:PAL|MISC|Cardboard|Euro|Industrial)/i);
      shipmentDetails.push({
        ID: huId,
        Pieces: qM ? parseInt(qM[1], 10) : 1,
        Length: mToCm(parseNum(dm[1])),
        Width:  mToCm(parseNum(dm[2])),
        Height: mToCm(parseNum(dm[3])),
        Weight: wM ? parseNum(wM[1]) : 0,
        CBM:    parseNum(dm[5]),
        Stackable: dm[4].trim() === '999',
      });
    }
  }

  return {
    transportOrder,
    totalPieces,
    totalGrossWeight,
    totalCBM,
    consignor,
    recipient,
    shipmentDetails,
  };
}
