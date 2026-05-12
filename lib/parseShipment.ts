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

// COPIA para aqui a tua lógica actual de parsing.
// Substitui TODO pelo código que já tens a extrair TO, totals, consignor, recipient, etc.
export function parseShipment(text: string): ParseResult {
  // TODO: implementação real (regex, splits, etc.)
  // Exemplo vazio só para compilar:
  return {
    transportOrder: '',
    totalPieces: 0,
    totalGrossWeight: 0,
    totalCBM: 0,
    consignor: '',
    recipient: '',
    shipmentDetails: []
  };
}
