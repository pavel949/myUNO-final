/** Valid physical hierarchy kinds. Commercial inventory categories are separate. */
export const structureKinds = [
  'phase','cluster','building','tower','wing','floor','block','zone','standalone',
] as const;
export type StructureKind = (typeof structureKinds)[number];
