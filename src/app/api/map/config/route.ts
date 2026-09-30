import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveIntegrationValue } from '@/modules/integrations/admin-registry';

export async function GET() {
  const [provider, styleUrl] = await Promise.all([
    resolveIntegrationValue(prisma, 'map_tiles', 'provider', 'NEXT_PUBLIC_MAP_PROVIDER'),
    resolveIntegrationValue(prisma, 'map_tiles', 'styleUrl', 'NEXT_PUBLIC_MAP_STYLE_URL'),
  ]);

  return NextResponse.json({
    provider: provider || 'maplibre',
    styleUrl: styleUrl || 'https://tiles.openfreemap.org/styles/liberty',
  });
}
