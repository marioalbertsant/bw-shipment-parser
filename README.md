# BW Shipment Parser (Vercel)

Serverless function em Node.js/TypeScript para extrair `ShipmentDetails` a partir
do texto dos PDFs da 4flow/BorgWarner.

A função é chamada a partir de um fluxo Power Automate (licença standard) usando
o workaround com **OneDrive for Business – Upload file from URL**.

## Endpoint

```http
GET /api/parse?fileUrl={url-encoded-onedrive-share-link}
```

- `fileUrl` deve ser um link de partilha de ficheiro `.txt` no OneDrive,
  contendo o texto plano do PDF.

Exemplo de resposta:

```json
[
  {
    "ID": 1,
    "Pieces": 2,
    "Length": 30,
    "Width": 30,
    "Height": 30,
    "Weight": 20.0,
    "CBM": 0.054,
    "Stackable": ""
  },
  {
    "ID": 2,
    "Pieces": 6,
    "Length": 120,
    "Width": 80,
    "Height": 75,
    "Weight": 968.0,
    "CBM": 4.32,
    "Stackable": ""
  }
]
```

## Desenvolvimento local

1. Instalar dependências:

```bash
npm install
# ou
pnpm install
```

2. Instalar o Vercel CLI (opcional, mas recomendado):

```bash
npm i -g vercel
vercel login
```

3. Correr em modo dev:

```bash
vercel dev
```

A função fica disponível em:

```text
http://localhost:3000/api/parse
```

## Deploy

A partir da raiz do repositório:

```bash
vercel
# depois de ligado ao projeto
vercel deploy --prod
```

A Vercel cria um domínio `https://seu-projeto.vercel.app`. A função estará em:

```text
https://seu-projeto.vercel.app/api/parse
```

## Notas

- Parser atual assume o layout de assignment list da 4flow com:
  - `Standard` a anteceder o primeiro set de dimensões;
  - Cada HU termina em volume `... m³`;
  - `Air Freight` no primeiro HU e `PAL_*` nos seguintes para deduzir `Pieces`.
- Se o layout mudar, basta ajustar a função `parseShipmentDetails` em `api/parse.ts`.
