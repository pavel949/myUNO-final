/** Only established command workspaces suppress guest discovery chrome. */
export function isStitchWorkspace(pathname: string): boolean {
  return ['/ops', '/mc', '/owner', '/provider', '/app/admin', '/admin/finance'].some(
    prefix => pathname === prefix || pathname.startsWith(prefix + '/'),
  );
}
