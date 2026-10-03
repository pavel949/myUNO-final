import { describe, it, expect } from 'vitest';
import { resolveLanding, availableSurfaces } from '@/modules/core';
describe('agent entry points',()=>{
 it('routes activated agents to HomeSpace while keeping active stay and admin precedence',()=>{
  expect(resolveLanding({isAdmin:false,roles:[],hasAgentWorkspace:true}).path).toBe('/agent');
  expect(resolveLanding({isAdmin:false,roles:[],hasAgentWorkspace:true,activeBookingId:'stay'}).reason).toBe('active_stay');
  expect(resolveLanding({isAdmin:true,roles:[],hasAgentWorkspace:true}).path).toBe('/app/admin');
 });
 it('keeps the agent workspace accessible alongside other roles',()=>{
  expect(availableSurfaces({isAdmin:false,roles:['owner'],hasAgentWorkspace:true}).map(s=>s.path)).toEqual(['/agent','/owner']);
 });
});
