import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LocaleProvider } from '@/components/LocaleProvider';
import { OperationalText, OperationalCopyProvider, operationalStaticText } from './OperationalText';
import { OPERATIONAL_STATIC_COPY, OPERATIONAL_STATIC_KEYS } from '@/modules/content/operational-static.seed';

describe('operational static interface translation', () => {
  it('renders Russian on first render and retains surrounding spaces', () => {
    render(<LocaleProvider locale="ru"><p data-testid="copy"><OperationalText text=" Add amenity or facility " /></p></LocaleProvider>);
    expect(screen.getByTestId('copy').textContent).toBe(' Добавить удобство или инфраструктуру ');
  });
  it('keeps the selected-language CMS copy authoritative', () => {
    const key = OPERATIONAL_STATIC_COPY['Add amenity or facility'].key;
    render(<LocaleProvider locale="ru"><OperationalCopyProvider labels={{ [key]: 'Добавить инфраструктуру комплекса' }}><OperationalText text="Add amenity or facility" /></OperationalCopyProvider></LocaleProvider>);
    expect(screen.getByText('Добавить инфраструктуру комплекса')).toBeInTheDocument();
  });
  it('preserves English and does not translate object names, URLs or identifiers', () => {
    expect(operationalStaticText('Add amenity or facility', 'en')).toBe('Add amenity or facility');
    for (const text of ['Layantara Villa Resort', 'unit-123', 'https://example.test', 'private_pool']) {
      expect(operationalStaticText(text, 'ru')).toBe(text);
    }
  });
  it('registers nonempty Russian copy and preserves all interpolation names', () => {
    for (const row of OPERATIONAL_STATIC_KEYS) {
      expect(row.ru.trim(), row.key).not.toBe('');
      const params = (s: string) => Array.from(s.matchAll(/\{([a-zA-Z_]\w*)\}/g), match => match[1]).sort();
      expect(params(row.ru), row.key).toEqual(params(row.en));
    }
  });
});
