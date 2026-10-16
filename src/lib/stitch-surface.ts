/** Only established command workspaces suppress guest discovery chrome. */
export function isStitchWorkspace(pathname: string): boolean {
  if (pathname === '/property' || ['/property/content', '/property/pricing', '/property/booking-mode', '/property/access', '/property/create'].some(prefix => pathname === prefix || pathname.startsWith(prefix + '/'))) return true;
  return ['/juristic', '/admin', '/ops', '/mc', '/owner', '/provider', '/app/admin', '/admin/finance'].some(
    prefix => pathname === prefix || pathname.startsWith(prefix + '/'),
  );
}
