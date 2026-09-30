export const PROJECT_EXPERIENCE_CONTENT_FIELDS = [
  { key: 'description', label: 'Project description', kind: 'project_description' },
  { key: 'handbook', label: 'Guest handbook teaser', kind: 'project_handbook' },
  { key: 'house_rules', label: 'House rules', kind: 'project_rules' },
  { key: 'shuttle_schedule', label: 'Shuttle / transport schedule', kind: 'project_transport' },
  { key: 'editorial.eyebrow', label: 'Positioning kicker', kind: 'editorial' },
  { key: 'editorial.headline', label: 'Main positioning headline', kind: 'editorial' },
  { key: 'editorial.lead', label: 'Positioning summary', kind: 'editorial' },
  { key: 'editorial.benefits.title', label: 'Advantages section title', kind: 'editorial' },
  { key: 'editorial.benefit.1.title', label: 'Advantage 1 title', kind: 'editorial' },
  { key: 'editorial.benefit.1.body', label: 'Advantage 1 description', kind: 'editorial' },
  { key: 'editorial.benefit.2.title', label: 'Advantage 2 title', kind: 'editorial' },
  { key: 'editorial.benefit.2.body', label: 'Advantage 2 description', kind: 'editorial' },
  { key: 'editorial.benefit.3.title', label: 'Advantage 3 title', kind: 'editorial' },
  { key: 'editorial.benefit.3.body', label: 'Advantage 3 description', kind: 'editorial' },
  { key: 'editorial.benefit.4.title', label: 'Advantage 4 title', kind: 'editorial' },
  { key: 'editorial.benefit.4.body', label: 'Advantage 4 description', kind: 'editorial' },
  { key: 'editorial.location.title', label: 'Location section title', kind: 'editorial' },
  { key: 'editorial.location.body', label: 'Project location story', kind: 'editorial' },
  { key: 'editorial.groups.title', label: 'Groups / use-case title', kind: 'editorial' },
  { key: 'editorial.groups.body', label: 'Groups / use-case description', kind: 'editorial' },
  { key: 'editorial.groups.cta', label: 'Groups CTA', kind: 'editorial' },
] as const;

export type ProjectExperienceContentField = typeof PROJECT_EXPERIENCE_CONTENT_FIELDS[number];

export function projectExperienceContentKey(
  project: { slug: string; descriptionKey: string; handbookKey: string },
  field: string
) {
  if (field === 'description') return project.descriptionKey;
  if (field === 'handbook') return project.handbookKey;
  if (field === 'house_rules') return `project.${project.slug}.house_rules`;
  if (field === 'shuttle_schedule') return `project.${project.slug}.shuttle_schedule`;
  if (field.startsWith('editorial.')) return `project.${project.slug}.${field}`;
  throw new Error('Unsupported project experience content field');
}
