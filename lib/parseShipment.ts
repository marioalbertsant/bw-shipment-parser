export interface ShipmentDetail {
  ID: number;
  Pieces: number;
  Length: number;
  Width: number;
  Height: number;
  Weight: number;
  CBM: number;
  Stackable: boolean;
}

export interface ParsedShipment {
  transportOrder: string;
  totalPieces: number;
  totalGrossWeight: number;
  totalCBM: number;
  consignor: string;
  recipient: string;
  shipmentDetails: ShipmentDetail[];
}

export function parseShipment(text: string): ParsedShipment {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // --- Helper ---
  const findValue = (label: string): string => {
    for (const line of lines) {
      const idx = line.indexOf(label);
      if (idx !== -1) {
        const after = line.slice(idx + label.length).trim();
        if (after) return after.split(/\s{2,}|\t/)[0].trim();
      }
    }
    return "";
  };

  const parseNum = (val: string): number => {
    const cleaned = val.replace(/[^\d.,]/g, "").replace(",", ".");
    return parseFloat(cleaned) || 0;
  };

  // --- Header fields ---
  const transportOrder =
    findValue("Transport Order:") ||
    findValue("Order No:") ||
    findValue("Transport Order No") ||
    findValue("Shipment No") ||
    findValue("Ref:");

  const consignor =
    findValue("Consignor:") ||
    findValue("Shipper:") ||
    findValue("Sender:");

  const recipient =
    findValue("Recipient:") ||
    findValue("Consignee:") ||
    findValue("Receiver:");

  const totalPiecesRaw =
    findValue("Total Pieces:") ||
    findValue("Total Pkgs:") ||
    findValue("No. of Pieces:");

  const totalWeightRaw =
    findValue("Total Gross Weight:") ||
    findValue("Total Weight:") ||
    findValue("Gross Weight:");

  const totalCBMRaw =
    findValue("Total CBM:") ||
    findValue("CBM:") ||
    findValue("Volume:");

  const totalPieces = parseNum(totalPiecesRaw);
  const totalGrossWeight = parseNum(totalWeightRaw);
  const totalCBM = parseNum(totalCBMRaw);

  // --- Shipment detail rows ---
  // Detect header row containing "Pieces" or "Pcs" and "Length"
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].toLowerCase();
    if (
      (l.includes("pieces") || l.includes("pcs")) &&
      (l.includes("length") || l.includes("l(m)")) &&
      (l.includes("weight") || l.includes("kg"))
    ) {
      headerIdx = i;
      break;
    }
  }

  const shipmentDetails: ShipmentDetail[] = [];

  if (headerIdx !== -1) {
    let id = 1;
    for (let i = headerIdx + 1; i < lines.length; i++) {
      const line = lines[i];

      // Stop if summary/total row encountered
      if (/total|totals|subtotal/i.test(line)) break;

      // Split by 2+ spaces or tabs
      const cols = line.split(/\s{2,}|\t/).map((c) => c.trim()).filter((c) => c !== "");

      // Expect at least 7 columns: Pieces, L, W, H, Weight, CBM, Stackable
      if (cols.length < 6) continue;

      // Detect if first col is a row number — skip it
      let offset = 0;
      if (/^\d+$/.test(cols[0]) && cols.length >= 7) offset = 0;

      const pieces    = parseNum(cols[offset]);
      const length    = parseNum(cols[offset + 1]);
      const width     = parseNum(cols[offset + 2]);
      const height    = parseNum(cols[offset + 3]);
      const weight    = parseNum(cols[offset + 4]);
      const cbm       = parseNum(cols[offset + 5]);
      const stackRaw  = cols[offset + 6] ?? "";

      // Skip rows that don't look like data
      if (pieces === 0 && length === 0) continue;

      const stackable = stackRaw.trim() === "999";

      shipmentDetails.push({
        ID: id++,
        Pieces: pieces,
        Length: length,
        Width: width,
        Height: height,
        Weight: weight,
        CBM: cbm,
        Stackable: stackable,
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

