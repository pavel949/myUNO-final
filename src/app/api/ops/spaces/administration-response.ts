import { NextResponse } from 'next/server';
import { AdministrationError } from '@/modules/core/administration.service';

export function administrationResponse(error: unknown) {
  if (error instanceof AdministrationError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof SyntaxError) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  // Do not serialize Prisma errors, credentials, password hashes or private account fields.
  return NextResponse.json({ error: 'Account change could not be completed' }, { status: 409 });
}
