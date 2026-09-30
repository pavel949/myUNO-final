'use client';

import { useEffect, useRef } from 'react';
import maplibregl, { LngLatBounds, Map as MapLibreMap, Marker, Popup } from 'maplibre-gl';
import type { MapEntity } from '@/modules/map';
import { PHUKET_MAP_CENTER, PHUKET_MAP_ZOOM, getPublicMapStyleUrl } from '@/modules/map';

export function MyUNOMap({
  entities,
  className = 'h-[70vh] min-h-[520px]',
  selectedId,
  onSelect,
}: {
  entities: MapEntity[];
  className?: string;
  selectedId?: string | null;
  onSelect?: (entity: MapEntity) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: getPublicMapStyleUrl(),
      center: [PHUKET_MAP_CENTER.longitude, PHUKET_MAP_CENTER.latitude],
      zoom: PHUKET_MAP_ZOOM,
      attributionControl: true,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');
    mapRef.current = map;

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    const bounds = new LngLatBounds();

    for (const entity of entities) {
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('aria-label', entity.title);
      button.style.width = entity.kind === 'project' ? '30px' : '24px';
      button.style.height = entity.kind === 'project' ? '30px' : '24px';
      button.style.borderRadius = '9999px';
      button.style.border = entity.id === selectedId ? '3px solid white' : '2px solid white';
      button.style.background =
        entity.kind === 'project'
          ? '#123D40'
          : entity.kind === 'unit'
            ? '#D7A84B'
            : entity.kind === 'provider'
              ? '#315C68'
              : '#8B6B42';
      button.style.boxShadow = '0 4px 18px rgba(0,0,0,.22)';
      button.style.cursor = 'pointer';

      const card = document.createElement('div');
      card.style.maxWidth = '240px';

      const title = document.createElement('strong');
      title.textContent = entity.title;
      title.style.display = 'block';
      title.style.marginBottom = '4px';
      card.appendChild(title);

      if (entity.subtitle) {
        const subtitle = document.createElement('div');
        subtitle.textContent = entity.subtitle;
        subtitle.style.marginBottom = '8px';
        subtitle.style.opacity = '.72';
        card.appendChild(subtitle);
      }

      const link = document.createElement('a');
      link.href = entity.href;
      link.textContent = entity.badge || entity.kind;
      link.style.textDecoration = 'underline';
      card.appendChild(link);

      button.addEventListener('click', () => onSelect?.(entity));

      const marker = new Marker({ element: button })
        .setLngLat([entity.longitude, entity.latitude])
        .setPopup(new Popup({ offset: 18, closeButton: true }).setDOMContent(card))
        .addTo(map);

      markersRef.current.push(marker);
      bounds.extend([entity.longitude, entity.latitude]);
    }

    if (entities.length === 1) {
      map.easeTo({
        center: [entities[0].longitude, entities[0].latitude],
        zoom: Math.max(map.getZoom(), 13),
      });
    } else if (entities.length > 1 && !bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 72, maxZoom: 13, duration: 500 });
    }
  }, [entities, selectedId, onSelect]);

  return (
    <div
      ref={containerRef}
      className={`w-full overflow-hidden rounded-xl border border-border-line bg-surface-paper ${className}`}
    />
  );
}
