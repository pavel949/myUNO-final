import crypto from 'crypto';

export const CATEGORY_QUOTE_TTL_MS = 10 * 60 * 1000;

export interface CategoryStayQuotePayload {
  version: 1;
  inventoryCategoryId: string;
  projectId: string;
  startDate: string;
  endDate: string;
  adultsCount: number;
  childrenCount: number;
  petsCount: number;
  acceptedTotalSatang: number;
  quotedUnitId: string;
  expiresAtMs: number;
}

function getQuoteSecret(): string {
  const secret = process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SESSION_SECRET is required in production');
    }
    return 'dev-only-insecure-category-quote-secret';
  }
  return secret;
}

function sign(encodedPayload: string): string {
  return crypto.createHmac('sha256', getQuoteSecret()).update(encodedPayload).digest('base64url');
}

export function createCategoryStayQuoteToken(
  payload: Omit<CategoryStayQuotePayload, 'version' | 'expiresAtMs'>,
  ttlMs: number = CATEGORY_QUOTE_TTL_MS
): { token: string; expiresAtMs: number } {
  const expiresAtMs = Date.now() + ttlMs;
  const full: CategoryStayQuotePayload = { version: 1, ...payload, expiresAtMs };
  const encoded = Buffer.from(JSON.stringify(full), 'utf8').toString('base64url');
  return { token: `v1.${encoded}.${sign(encoded)}`, expiresAtMs };
}

export function verifyCategoryStayQuoteToken(token: string): CategoryStayQuotePayload | null {
  const [version, encoded, signature, extra] = token.split('.');
  if (version !== 'v1' || !encoded || !signature || extra) return null;

  const expected = sign(encoded);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  const value = payload as Partial<CategoryStayQuotePayload>;
  if (
    value.version !== 1 ||
    typeof value.inventoryCategoryId !== 'string' ||
    typeof value.projectId !== 'string' ||
    typeof value.startDate !== 'string' ||
    typeof value.endDate !== 'string' ||
    typeof value.adultsCount !== 'number' ||
    typeof value.childrenCount !== 'number' ||
    typeof value.petsCount !== 'number' ||
    typeof value.acceptedTotalSatang !== 'number' ||
    !Number.isInteger(value.acceptedTotalSatang) ||
    value.acceptedTotalSatang < 0 ||
    typeof value.quotedUnitId !== 'string' ||
    typeof value.expiresAtMs !== 'number' ||
    value.expiresAtMs <= Date.now()
  ) {
    return null;
  }

  return value as CategoryStayQuotePayload;
}
