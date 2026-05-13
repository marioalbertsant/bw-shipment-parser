// lib/parseShipment.ts

export type ShipmentDetail = {
  ID: number;
  Pieces: number;
  Length: number;
  Width: number;
  Height: number;
  Weight: number;
  CBM: number;
  Stackable: string;
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

/**
 * Converte números no formato europeu/4flow para number JS.
 * Exemplos:
 *  - "401,14" -> 401.14
 *  - "0,624"  -> 0.624
 *  - "1.234,56" -> 1234.56
 */
function parseNumber(raw: string | undefined | null): number {
  if (!raw) return 0;
  const cleaned = raw
    .toString()
    .trim()
    .replace(/\s/g, '')
    // remover separador de milhares
    .replace(/\./g, '')
    // vírgula como separador decimal
    .replace(',', '.');
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Procura a primeira correspondência de regex e devolve o grupo 1 (ou string vazia).
 */
function matchGroup(text: string, regex: RegExp): string {
  const m = text.match(regex);
  return m?.[1]?.trim() ?? '';
}

export function parseShipment(text: string): ParseResult {
  // Normalizar um pouco o texto para facilitar regex
  const normalized = text.replace(/\r\n/g, '\n');

  // 1) Transport Order – aparece antes de "Consignor:" ou na tabela principal
  // Exemplo: "10178855   Consignor:  Porite..."
  let transportOrder = matchGroup(
    normalized,
    /(\d{6,})\s+Consignor:/,
  );

  if (!transportOrder) {
    // fallback: a seguir à coluna "Transport Order" na tabela principal
    // ...Delivery address                                      Transport Order          Service...
    // ...Colina Benefica (COB)                                 10178855                 Air Freight...
    transportOrder = matchGroup(
      normalized,
      /Delivery address[\s\S]+?Transport Order[\s\S]+?\n[^\n]*?\s(\d{6,})\s+Air Freight/,
    );
  }

  // 2) Consignor – linha "Consignor:"
  // Exemplo:
  // "Consignor:  Porite Yangzhou Technology&Industry Co., (ID: S-PORI01-CN22); -; ..."
  let consignor = matchGroup(
    normalized,
    /Consignor:\s+(.+?)(?:\s*\(ID:|;)/,
  );
  consignor = consignor.replace(/,\s*$/, '').trim();

  // 3) Recipient – linha "Recipient:"
  // Exemplo:
  // "Recipient:  Colina Benefica (COB) (ID: P-EVIA-PT49); BW Division: ETTS; ..."
  let recipient = matchGroup(
    normalized,
    /Recipient:\s+(.+?)(?:\s*\(ID:|;)/,
  );
  recipient = recipient.replace(/,\s*$/, '').trim();

  // 4) Totais – Sum packaging / Sum weight / Sum volume
  // Exemplo:
  // "Sum packaging:                        1"
  // "Sum weight:                     401,14 kg"
  // "Sum volume:                     0,624 m³"
  const totalPiecesStr = matchGroup(
    normalized,
    /Sum packaging:\s+(\d+)/,
  );
  const totalGrossWeightStr = matchGroup(
    normalized,
    /Sum weight:\s+([\d.,]+)\s*kg/i,
  );
  const totalCBMStr = matchGroup(
    normalized,
    /Sum volume:\s+([\d.,]+)\s*m³/i,
  );

  let totalPieces = parseInt(totalPiecesStr || '0', 10);
  if (!Number.isFinite(totalPieces)) totalPieces = 0;

  const totalGrossWeight = parseNumber(totalGrossWeightStr);
  const totalCBM = parseNumber(totalCBMStr);

  // 5) Shipment Details (pcs, length, width, height, cbm)
  //
  // Padrões típicos no texto:
  //  - "1,2x0,8x0,65 m"  (comprimento x largura x altura em metros, vírgula decimal)
  //  - "0,624 m³"        (volume por HU)
  //  - "... Air Freight        1                        PAL_EUR ..." (qty / PAL_*)
  //
  // Estratégia:
  //   1) Recolher todas as dimensões (LxWxH m)
  //   2) Recolher todos os volumes (m³)
  //   3) Recolher todas as quantidades de PAL_* (pieces por HU)
  //   4) Emparelhar por ordem: primeira dimensão + primeiro volume + primeiro PAL_*
  //      → ShipmentDetail ID=1, etc.

  const dimsRegex =
    /(\d+(?:[.,]\d+)?)x(\d+(?:[.,]\d+)?)x(\d+(?:[.,]\d+)?)\s*m/gi;
  const volumeRegex = /(\d+(?:[.,]\d+)?)\s*m³/gi;
  const palQtyRegex = /(\d+)\s+PAL_/gi;

  const dims: { lengthCm: number; widthCm: number; heightCm: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = dimsRegex.exec(normalized)) !== null) {
    const lengthM = parseNumber(m[1]);
    const widthM = parseNumber(m[2]);
    const heightM = parseNumber(m[3]);
    // converter para cm e arredondar
    dims.push({
      lengthCm: Math.round(lengthM * 100),
      widthCm: Math.round(widthM * 100),
      heightCm: Math.round(heightM * 100),
    });
  }

  const volumes: number[] = [];
  let v: RegExpExecArray | null;
  while ((v = volumeRegex.exec(normalized)) !== null) {
    volumes.push(parseNumber(v[1]));
  }

  const palQuantities: number[] = [];
  let q: RegExpExecArray | null;
  while ((q = palQtyRegex.exec(normalized)) !== null) {
    const qty = parseInt(q[1], 10);
    if (Number.isFinite(qty)) {
      palQuantities.push(qty);
    }
  }

  // Construir shipmentDetails, emparelhando por índice
  const shipmentDetails: ShipmentDetail[] = [];
  const count = dims.length || volumes.length || palQuantities.length;

  for (let i = 0; i < count; i++) {
    const dim = dims[i];
    const cbm = volumes[i] ?? 0;
    const pieces =
      palQuantities[i] ??
      (count === 1 && totalPieces > 0 ? totalPieces : 1);

    shipmentDetails.push({
      ID: i + 1,
      Pieces: pieces,
      Length: dim?.lengthCm ?? 0,
      Width: dim?.widthCm ?? 0,
      Height: dim?.heightCm ?? 0,
      // Sem padrão estável para peso por HU: deixo 0 por agora,
      // podes depois ajustar se precisares de granularidade.
      Weight: 0,
      CBM: cbm,
      Stackable: '',
    });
  }

  // Se não houver totalPieces mas já temos detalhes, somar as peças
  if (!totalPieces && shipmentDetails.length) {
    totalPieces = shipmentDetails.reduce(
      (sum, d) => sum + (d.Pieces || 0),
      0,
    );
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
