import { UI_LOCALE } from '@/lib/format';
type NearbyLabels = {
  kicker: string;
  title: string;
  body: string;
  distance: string;
  walk: string;
  drive: string;
  openMap: string;
};

export type ProjectNearbyPlaceCard = {
  id: string;
  name: string;
  categoryKey: string;
  shortDescription: string | null;
  address: string | null;
  distanceMeters: number | null;
  walkingMinutes: number | null;
  drivingMinutes: number | null;
  mapUrl: string | null;
  isFeatured: boolean;
};

function human(value: string) {
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function displayDistance(meters: number) {
  if (meters < 1000) return Math.max(50, Math.round(meters / 50) * 50).toLocaleString(UI_LOCALE) + ' m';
  const kilometres = meters / 1000;
  return (kilometres < 10 ? kilometres.toFixed(1) : Math.round(kilometres).toString()) + ' km';
}

export default function ProjectNearbySection({
  places,
  labels,
}: {
  places: ProjectNearbyPlaceCard[];
  labels: NearbyLabels;
}) {
  if (!places.length) return null;
  const featured = places.filter((place) => place.isFeatured);
  const visible = (featured.length ? featured : places).slice(0, 8);

  return (
    <section id="nearby" className="px-20 py-48 md:px-32 md:py-64">
      <div className="mx-auto max-w-content">
        <p className="text-kicker font-semibold uppercase text-brand-andaman">{labels.kicker}</p>
        <h2 className="mt-8 font-display text-display-xl font-semibold text-text-ink">
          {labels.title}
        </h2>
        <p className="mt-8 max-w-3xl text-body text-text-secondary">{labels.body}</p>

        <div className="mt-24 grid gap-16 sm:grid-cols-2 lg:grid-cols-4">
          {visible.map((place) => (
            <article key={place.id} className="rounded-lg border border-border-line bg-surface-paper p-20 shadow-card">
              <p className="text-kicker uppercase text-brand-andaman">{human(place.categoryKey)}</p>
              <h3 className="mt-4 font-display text-heading-3 font-semibold text-text-ink">
                {place.name}
              </h3>
              {place.shortDescription ? (
                <p className="mt-8 text-small leading-relaxed text-text-secondary">
                  {place.shortDescription}
                </p>
              ) : null}
              {place.address ? (
                <p className="mt-8 text-small text-text-secondary">{place.address}</p>
              ) : null}
              <div className="mt-12 flex flex-wrap gap-8 text-small text-text-secondary">
                {place.distanceMeters !== null ? (
                  <span className="rounded-full bg-surface-sand px-12 py-4">
                    {labels.distance.replace('{distance}', displayDistance(place.distanceMeters))}
                  </span>
                ) : null}
                {place.walkingMinutes !== null ? (
                  <span className="rounded-full bg-surface-sand px-12 py-4">
                    {labels.walk.replace('{minutes}', String(place.walkingMinutes))}
                  </span>
                ) : null}
                {place.drivingMinutes !== null ? (
                  <span className="rounded-full bg-surface-sand px-12 py-4">
                    {labels.drive.replace('{minutes}', String(place.drivingMinutes))}
                  </span>
                ) : null}
              </div>
              {place.mapUrl ? (
                <a
                  href={place.mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-16 inline-flex text-small font-semibold text-brand-andaman hover:underline"
                >
                  {labels.openMap}
                </a>
              ) : null}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
