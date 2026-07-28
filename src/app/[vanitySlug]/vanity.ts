import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';

/**
 * Shared helpers for the vanity-URL route handlers (LY-5): slug lookup and
 * a localized, real-status 404 response. Lives beside the handlers but is
 * not a route file (route.ts may only export HTTP methods).
 */
export async function resolveLiveProjectSlug(
  vanitySlug: string
): Promise<string | null> {
  const project = await prisma.project.findUnique({
    where: { slug: vanitySlug },
    select: { slug: true, status: true },
  });
  return project && project.status === 'live' ? project.slug : null;
}

// Inline styles mirror the design tokens (brand.andaman #0f4c5c,
// surface.ivory #faf7f2, text ink/secondary) — a route handler response has
// no Tailwind pipeline, and this tiny page must stand alone.
export async function vanityNotFound(): Promise<NextResponse> {
  const labels = await getLabels({
    'common.not_found.title': 'Page not found',
    'common.not_found.body': "The page you're looking for doesn't exist or has moved.",
    'common.not_found.home': 'Back to home',
  });
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>404 · ${labels['common.not_found.title']}</title></head><body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;background:#faf7f2;color:#1c2b2d"><div style="max-width:28rem;padding:2rem;text-align:center"><p style="font-size:2.5rem;font-weight:700;color:#0f4c5c;margin:0 0 1rem">404</p><h1 style="font-size:1.25rem;margin:0 0 .75rem">${labels['common.not_found.title']}</h1><p style="color:#5b6b6d;margin:0 0 1.5rem">${labels['common.not_found.body']}</p><a href="/" style="display:inline-block;padding:.75rem 1.5rem;border-radius:.375rem;background:#0f4c5c;color:#faf7f2;text-decoration:none;font-weight:500">${labels['common.not_found.home']}</a></div></body></html>`;
  return new NextResponse(html, {
    status: 404,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}
