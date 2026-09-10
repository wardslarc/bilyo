import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { signSignedPayload, verifySignedToken } from '../lib/signed-token.ts';

describe('lib/signed-token.ts', () => {
  const secretA = 'secret-key-alpha-32-characters-long!';
  const secretB = 'secret-key-beta--32-characters-long!';

  test('signs and successfully verifies a payload', () => {
    const payload = { userId: 'usr_123', email: 'test@example.com', nonce: 'abc', timestamp: 123456789 };
    const token = signSignedPayload(payload, secretA);

    assert.ok(typeof token === 'string');
    assert.match(token, /^[A-Za-z0-9_-]+\.[0-9a-fA-F]{64}$/);

    const verified = verifySignedToken<typeof payload>(token, secretA);
    assert.deepEqual(verified, payload);
  });

  test('rejects token verified with a different secret', () => {
    const payload = { role: 'admin', privileged: true };
    const token = signSignedPayload(payload, secretA);

    const verified = verifySignedToken<typeof payload>(token, secretB);
    assert.equal(verified, null);
  });

  test('detects and rejects tampered payload', () => {
    const payload = { userId: 'usr_123', role: 'USER' };
    const token = signSignedPayload(payload, secretA);
    const [, sig] = token.split('.');

    // Tamper payload to elevate role
    const tamperedJson = JSON.stringify({ userId: 'usr_123', role: 'ADMIN' });
    const tamperedBase64 = Buffer.from(tamperedJson).toString('base64url');
    const tamperedToken = `${tamperedBase64}.${sig}`;

    const verified = verifySignedToken(tamperedToken, secretA);
    assert.equal(verified, null);
  });

  test('detects and rejects tampered signature', () => {
    const payload = { id: 'test' };
    const token = signSignedPayload(payload, secretA);
    const [base64, sig] = token.split('.');

    // Flip last hex char
    const flippedChar = sig.endsWith('a') ? 'b' : 'a';
    const tamperedSig = sig.slice(0, -1) + flippedChar;
    const tamperedToken = `${base64}.${tamperedSig}`;

    const verified = verifySignedToken(tamperedToken, secretA);
    assert.equal(verified, null);
  });

  test('rejects malformed tokens', () => {
    assert.equal(verifySignedToken('', secretA), null);
    assert.equal(verifySignedToken('invalid-token', secretA), null);
    assert.equal(verifySignedToken('part1.part2.part3', secretA), null);
    assert.equal(verifySignedToken('part1.not-a-valid-hex-signature', secretA), null);
    // @ts-expect-error test non-string input
    assert.equal(verifySignedToken(null, secretA), null);
    // @ts-expect-error test non-string input
    assert.equal(verifySignedToken(undefined, secretA), null);
  });
});
