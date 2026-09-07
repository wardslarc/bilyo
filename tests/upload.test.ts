import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateImageBuffer, MAX_LOGO_SIZE_BYTES } from '../lib/blob.ts';

describe('Image Upload & Magic Bytes Validation (M6-T01)', () => {
  it('accepts a valid PNG buffer', () => {
    // Standard PNG header: 89 50 4E 47 0D 0A 1A 0A followed by IHDR chunk bytes
    const pngHeader = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    ]);

    const result = validateImageBuffer(pngHeader, 'image/png');
    assert.equal(result.ok, true);
    assert.equal(result.mimeType, 'image/png');
    assert.equal(result.extension, 'png');
  });

  it('accepts a valid JPEG buffer', () => {
    // Standard JPEG start: FF D8 FF E0 ...
    const jpegHeader = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46,
      0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
    ]);

    const result = validateImageBuffer(jpegHeader, 'image/jpeg');
    assert.equal(result.ok, true);
    assert.equal(result.mimeType, 'image/jpeg');
    assert.equal(result.extension, 'jpg');
  });

  it('accepts a valid WebP buffer', () => {
    // WebP structure: RIFF (4 bytes) + file size (4 bytes) + WEBP (4 bytes)
    const webpHeader = Buffer.from([
      0x52, 0x49, 0x46, 0x46, // 'RIFF'
      0x24, 0x00, 0x00, 0x00, // length
      0x57, 0x45, 0x42, 0x50, // 'WEBP'
      0x56, 0x50, 0x38, 0x20, // 'VP8 '
    ]);

    const result = validateImageBuffer(webpHeader, 'image/webp');
    assert.equal(result.ok, true);
    assert.equal(result.mimeType, 'image/webp');
    assert.equal(result.extension, 'webp');
  });

  it('rejects a renamed Windows executable (.exe with MZ header)', () => {
    // DOS/PE executable starts with 'MZ' (0x4D, 0x5A)
    const exeBuffer = Buffer.from([
      0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00,
      0x04, 0x00, 0x00, 0x00, 0xff, 0xff, 0x00, 0x00,
    ]);

    const result = validateImageBuffer(exeBuffer, 'image/png');
    assert.equal(result.ok, false);
    assert.match(result.error || '', /executable/i);
  });

  it('rejects an ELF binary executable', () => {
    // ELF executable starts with 0x7F 'E' 'L' 'F'
    const elfBuffer = Buffer.from([
      0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]);

    const result = validateImageBuffer(elfBuffer, 'image/png');
    assert.equal(result.ok, false);
    assert.match(result.error || '', /executable/i);
  });

  it('rejects plain text or HTML pretending to be an image', () => {
    const textBuffer = Buffer.from('<!DOCTYPE html><html><body>malicious payload</body></html>');

    const result = validateImageBuffer(textBuffer, 'image/png');
    assert.equal(result.ok, false);
    assert.match(result.error || '', /invalid file format/i);
  });

  it('rejects files smaller than 12 bytes', () => {
    const tinyBuffer = Buffer.from([0x89, 0x50, 0x4e]);

    const result = validateImageBuffer(tinyBuffer, 'image/png');
    assert.equal(result.ok, false);
    assert.match(result.error || '', /too small/i);
  });

  it('rejects a declared content-type mismatch', () => {
    // Real PNG payload declared as JPEG
    const pngHeader = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    ]);

    const result = validateImageBuffer(pngHeader, 'image/jpeg');
    assert.equal(result.ok, false);
    assert.match(result.error || '', /mismatch/i);
  });

  it('enforces the 2MB size cap strictly', () => {
    const oversizedBytes = MAX_LOGO_SIZE_BYTES + 1;
    const pngHeader = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    ]);

    // Test with declaredSize exceeding limit
    const result = validateImageBuffer(pngHeader, 'image/png', oversizedBytes);
    assert.equal(result.ok, false);
    assert.match(result.error || '', /2MB limit/i);
  });
});
