// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import OwnerEvidenceDraftEditor from './OwnerEvidenceDraftEditor';
import { OWNER_EVIDENCE_KEYS, ownerEvidenceLabelsForLocale } from '@/modules/content/owner-evidence.seed';
const fetcher = vi.fn();
const value = { ownerEntity: { legalName:'Company', businessAddress:null }, ownerRepresentative:{displayName:'Director',title:null},
  operatorEntity:{legalName:'Operator',businessAddress:null},operatorRepresentative:{displayName:'Manager',title:null},
  source:{url:'https://docs.google.com/document/d/abc/edit',title:'Copy',modifiedDate:null},
  contract:{proposedCommencementDate:null,proposedTermYears:null,sourceCopySignatureStatus:'not_checked'} };
const snapshot = { projectId:'p',version:'a'.repeat(64),draft:{schemaVersion:1,revision:1,evidence:value,executionStatus:'unverified',ownershipStatus:'unverified',licenceStatus:'unverified'} };
beforeEach(() => { fetcher.mockReset(); vi.stubGlobal('fetch',fetcher); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const ok = (data: unknown) => ({ok:true,json:async()=>data});
async function open() { render(<OwnerEvidenceDraftEditor projectId="p"/>); fireEvent.click(screen.getByText('Open evidence draft')); await screen.findByLabelText('Owner company legal name'); }
describe('owner evidence draft form', () => {
  it('does not fetch before explicitly opening and displays the unverified boundary', () => { render(<OwnerEvidenceDraftEditor projectId="p"/>); expect(fetcher).not.toHaveBeenCalled(); expect(screen.getByText(/does not verify title/)).toBeInTheDocument(); });
  it('saves source facts using the reviewed version, without approval or actor fields', async () => {
    fetcher.mockResolvedValueOnce(ok(snapshot)).mockResolvedValueOnce(ok({...snapshot,version:'b'.repeat(64)})); await open();
    fireEvent.change(screen.getByLabelText('Owner company legal name'),{target:{value:'Updated Company'}});
    fireEvent.submit(screen.getByText('Save unverified evidence draft').closest('form')!);
    await screen.findByRole('status'); const call = fetcher.mock.calls[1]; expect(call[0]).toBe('/api/admin/projects/p/owner-evidence');
    const body = JSON.parse(call[1].body); expect(Object.keys(body)).toEqual(['expectedVersion','evidence']); expect(body.expectedVersion).toBe(snapshot.version);
    expect(body.evidence.ownerEntity.legalName).toBe('Updated Company'); expect(screen.getByRole('status')).toHaveTextContent('launch approval are unchanged');
  });
  it('preserves edits on conflict and offers an explicit reload', async () => {
    fetcher.mockResolvedValueOnce(ok(snapshot)).mockResolvedValueOnce({ok:false,json:async()=>({error:'OWNER_EVIDENCE_CONFLICT'})}); await open();
    fireEvent.change(screen.getByLabelText('Owner company legal name'),{target:{value:'Keep this edit'}});
    fireEvent.submit(screen.getByText('Save unverified evidence draft').closest('form')!);
    expect(await screen.findByRole('alert')).toHaveTextContent('Your edits are still here'); expect(screen.getByLabelText('Owner company legal name')).toHaveValue('Keep this edit');
    expect(screen.getByText('Reload saved draft (replaces unsaved edits)')).toBeEnabled();
  });
  it('explicit reload discards unsaved edits even when the saved version is unchanged', async () => {
    fetcher.mockResolvedValueOnce(ok(snapshot)).mockResolvedValueOnce(ok(snapshot)); await open();
    fireEvent.change(screen.getByLabelText('Owner company legal name'), {target:{value:'Discard this edit'}});
    fireEvent.click(screen.getByText('Reload saved draft (replaces unsaved edits)'));
    await waitFor(() => expect(screen.getByLabelText('Owner company legal name')).toHaveValue('Company'));
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('blocks repeated requests while loading and renders forbidden errors', async () => {
    let resolve!: (v: unknown)=>void; fetcher.mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));
    render(<OwnerEvidenceDraftEditor projectId="p"/>); const button=screen.getByText('Open evidence draft'); fireEvent.click(button); fireEvent.click(button); expect(fetcher).toHaveBeenCalledTimes(1);
    resolve({ok:false,json:async()=>({error:'OWNER_EVIDENCE_FORBIDDEN'})}); await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('Only an active administrator')); expect(button).toBeEnabled();
  });
});

it.each(['en','ru','th','zh'])('has complete localised evidence chrome for %s', locale => {
  const labels=ownerEvidenceLabelsForLocale(locale); expect(Object.keys(labels)).toHaveLength(OWNER_EVIDENCE_KEYS.length);
  expect(Object.values(labels).every(v=>v.trim().length>0)).toBe(true);
  render(<OwnerEvidenceDraftEditor projectId="p" labels={labels}/>); expect(screen.getByText(labels['admin.owner_evidence.title'])).toBeInTheDocument();
  if(locale !== 'en') expect(labels['admin.owner_evidence.hint']).not.toBe(ownerEvidenceLabelsForLocale('en')['admin.owner_evidence.hint']);
});
