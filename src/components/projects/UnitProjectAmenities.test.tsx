import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import UnitProjectAmenities from './UnitProjectAmenities';
const state = vi.hoisted(() => ({ unit:vi.fn(), project:vi.fn(), amenities:vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma:{ unit:{ findUnique:state.unit } } }));
vi.mock('@/modules/projects/project-amenities.service', () => ({ getPublicAmenityProjectBySlug:state.project, listPublicProjectAmenities:state.amenities }));
vi.mock('@/lib/i18n', () => ({ getRequestLocale:()=>'en', getLabels:async (defaults:Record<string,string>)=>defaults }));
const project = { id:'complex', slug:'complex', name:'Complex', status:'draft' };
beforeEach(() => {
  state.unit.mockResolvedValue({ project }); state.project.mockResolvedValue(project);
  state.amenities.mockResolvedValue([{ id:'pool',slug:'pool',name:'Pool',categoryKey:null,shortDescription:null,locationLabel:'Floor 2',openingHours:{daily:'08:00–20:00'},isFeatured:false,coverUrl:null,pricingType:'not_specified',priceThb:null,bookingRequired:false,accessType:'not_specified' }]);
});
describe('linked units show canonical shared facilities', () => {
  it('reads the complex collection separately and links to its facility details', async () => {
    const html=renderToStaticMarkup(await UnitProjectAmenities({unitId:'public-unit'}));
    expect(state.amenities).toHaveBeenCalledWith(expect.anything(),'complex','en');
    expect(html).toContain('Shared complex facilities'); expect(html).toContain('/projects/complex/amenities/pool');
    expect(html).toContain('Floor 2'); expect(html).toContain('08:00–20:00');
  });
  it('does not show facilities when the canonical project gate rejects it', async () => {
    state.project.mockResolvedValue(null); expect(await UnitProjectAmenities({unitId:'public-unit'})).toBeNull();
  });
  it('does not show an empty facility section', async () => {
    state.amenities.mockResolvedValue([]); expect(await UnitProjectAmenities({unitId:'public-unit'})).toBeNull();
  });
});
