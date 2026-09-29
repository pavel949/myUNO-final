import { afterEach, describe, expect, it, vi } from 'vitest';
import { decryptDealFile, encryptDealFile } from './private-deal-evidence';

describe('encrypted private agreement evidence',()=>{
  afterEach(()=>vi.unstubAllEnvs());
  it('round-trips bytes without exposing source plaintext in the stored payload',()=>{
    vi.stubEnv('ENCRYPTION_KEY','ab'.repeat(32));
    const plain=Buffer.from('%PDF-1.7 test private contract');
    const cipher=encryptDealFile(plain);
    expect(cipher.equals(plain)).toBe(false);
    expect(cipher.includes(plain)).toBe(false);
    expect(decryptDealFile(cipher).equals(plain)).toBe(true);
  });
  it('authenticates ciphertext against any manipulation',()=>{
    vi.stubEnv('ENCRYPTION_KEY','ab'.repeat(32));
    const cipher=encryptDealFile(Buffer.from('private'));
    cipher[cipher.length-1]^=1;
    expect(()=>decryptDealFile(cipher)).toThrow();
  });
  it('refuses to operate without a server-only encryption key',()=>{
    vi.stubEnv('ENCRYPTION_KEY','');
    expect(()=>encryptDealFile(Buffer.from('private'))).toThrow('private_evidence_encryption_key_not_configured');
  });
});
