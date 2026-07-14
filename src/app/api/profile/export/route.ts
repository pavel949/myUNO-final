/**
 * GET /api/profile/export
 * Export personal data for GDPR/PDPA compliance (data-subject rights).
 * Auth required. Returns identity's own data in JSON format.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { exportIdentityData } from '@/modules/core';

export async function GET(_req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.identityId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Users can only export their own data
    const exportData = await exportIdentityData(prisma, user.identityId);

    // Return as JSON file
    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="personal-data-${new Date().toISOString().split('T')[0]}.json"`,
      },
    });
  } catch (error) {
    console.error('Data export error:', error);
    return NextResponse.json(
      { error: 'Export failed' },
      { status: 500 }
    );
  }
}
