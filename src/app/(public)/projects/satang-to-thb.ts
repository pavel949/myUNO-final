/**
 * Display boundary (Q47): every *Thb domain field (e.g. fromNightlyThb from
 * `listPublicProjects`) is stored in satang (THB x 100). This page must show
 * baht, never raw satang — this is the same conversion the project detail
 * page already applies correctly for its own fields.
 */
export const satangToThb = (satang: number) => Math.round(satang / 100).toLocaleString();
