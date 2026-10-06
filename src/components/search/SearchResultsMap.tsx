'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';

// MapLibre is bundled (pinned in package.json) and loaded on demand, so the
// search page never depends on a third-party CDN being up or allowed by CSP.
type MapLibre = typeof import('maplibre-gl');

export interface SearchMapProject {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  unitCount: number;
}

export function SearchResultsMap({
  projects,
  selectedProjectId,
  onSelectProject,
  onBoundsChange,
  labels,
  fitToProjects = false,
}: {
  projects: SearchMapProject[];
  selectedProjectId: string | null;
  onSelectProject: (projectId: string) => void;
  onBoundsChange: (bounds: { swLat: number; swLng: number; neLat: number; neLng: number }) => void;
  labels: { loading: string; unavailable: string; homes: string; aria: string };
  fitToProjects?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const libRef = useRef<MapLibre | null>(null);
  const markerRefs = useRef<Map<string, { marker: any; element: HTMLElement }>>(new Map());
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  const validProjects = useMemo(
    () =>
      projects.filter(
        (project) =>
          Number.isFinite(project.latitude) &&
          Number.isFinite(project.longitude) &&
          !(project.latitude === 0 && project.longitude === 0)
      ),
    [projects]
  );

  useEffect(() => {
    let cancelled = false;
    const start = (maplibregl: MapLibre) => {
      if (cancelled || !containerRef.current || mapRef.current) return;
      libRef.current = maplibregl;

      const map = new maplibregl.Map({
        container: containerRef.current,
        center: [98.32, 7.95],
        zoom: 10.2,
        minZoom: 8,
        maxZoom: 17,
        // Default attribution control (OSM credit) stays on.
        style: {
          version: 8,
          sources: {
            osm: {
              type: 'raster',
              tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
              tileSize: 256,
              attribution: '© OpenStreetMap contributors',
            },
          },
          layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
        },
      });

      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
      let timer: ReturnType<typeof setTimeout> | null = null;
      map.on('moveend', () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          const bounds = map.getBounds();
          onBoundsChange({
            swLat: Number(bounds.getSouth().toFixed(6)),
            swLng: Number(bounds.getWest().toFixed(6)),
            neLat: Number(bounds.getNorth().toFixed(6)),
            neLng: Number(bounds.getEast().toFixed(6)),
          });
        }, 350);
      });
      map.on('load', () => setReady(true));
      map.on('error', () => setFailed(true));
      mapRef.current = map;
    };

    import('maplibre-gl')
      .then((mod) => start((mod.default ?? mod) as MapLibre))
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [onBoundsChange]);

  useEffect(() => {
    const map = mapRef.current;
    const maplibregl = libRef.current;
    if (!ready || !map || !maplibregl) return;

    for (const entry of markerRefs.current.values()) entry.marker.remove();
    markerRefs.current.clear();

    for (const project of validProjects) {
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('aria-label', project.name);
      button.className =
        'rounded-full border border-brand-deep bg-surface-paper px-12 py-4 text-small font-semibold text-brand-deep shadow-card';
      button.textContent = project.unitCount > 1 ? String(project.unitCount) : '1';
      button.onclick = () => onSelectProject(project.id);

      const marker = new maplibregl.Marker({ element: button, anchor: 'bottom' })
        .setLngLat([project.longitude, project.latitude])
        .setPopup(
          new maplibregl.Popup({ offset: 18 }).setHTML(
            '<strong>' +
              project.name.replace(/[&<>"']/g, (char: string) =>
                ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' } as Record<string, string>)[char]
              ) +
              '</strong><br/>' +
              labels.homes.replace('{count}', String(project.unitCount))
          )
        )
        .addTo(map);
      markerRefs.current.set(project.id, { marker, element: button });
    }

    if (fitToProjects && validProjects.length > 0) {
      const bounds = new maplibregl.LngLatBounds();
      validProjects.forEach((project) => bounds.extend([project.longitude, project.latitude]));
      if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 56, maxZoom: 13, duration: 0 });
    }
  }, [ready, validProjects, onSelectProject, fitToProjects, labels.homes]);

  useEffect(() => {
    for (const [projectId, entry] of markerRefs.current.entries()) {
      entry.element.className =
        projectId === selectedProjectId
          ? 'rounded-full border-2 border-brand-sun bg-brand-deep px-12 py-4 text-small font-semibold text-surface-paper shadow-float'
          : 'rounded-full border border-brand-deep bg-surface-paper px-12 py-4 text-small font-semibold text-brand-deep shadow-card';
    }
  }, [selectedProjectId]);

  if (failed) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-md border border-border-line bg-surface-paper p-24 text-center text-small text-text-secondary">
        {labels.unavailable}
      </div>
    );
  }

  return (
    <div className="relative min-h-[420px] overflow-hidden rounded-md border border-border-line bg-surface-paper lg:sticky lg:top-[88px] lg:h-[calc(100vh-120px)]">
      {!ready ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-surface-paper text-small text-text-secondary">
          {labels.loading}
        </div>
      ) : null}
      <div ref={containerRef} className="h-full min-h-[420px] w-full" aria-label={labels.aria} />
    </div>
  );
}
