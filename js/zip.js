/* Minimal ZIP reader — no dependencies.
 * Uses the browser's native DecompressionStream for deflate entries.
 * Returns a Map of filename -> text for .json/.txt entries.
 */
const ZipReader = (() => {
  const td = new TextDecoder();

  function findEOCD(view) {
    // End of Central Directory signature: 0x06054b50, scan back over max comment length
    const start = Math.max(0, view.byteLength - 65558);
    for (let i = view.byteLength - 22; i >= start; i--) {
      if (view.getUint32(i, true) === 0x06054b50) return i;
    }
    throw new Error('Not a valid ZIP file (end-of-central-directory not found).');
  }

  async function inflate(bytes) {
    const ds = new DecompressionStream('deflate-raw');
    const stream = new Blob([bytes]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function readTextEntries(arrayBuffer) {
    const view = new DataView(arrayBuffer);
    const bytes = new Uint8Array(arrayBuffer);
    const eocd = findEOCD(view);
    const count = view.getUint16(eocd + 10, true);
    let offset = view.getUint32(eocd + 16, true);
    const files = new Map();

    for (let i = 0; i < count; i++) {
      if (view.getUint32(offset, true) !== 0x02014b50) break;
      const method = view.getUint16(offset + 10, true);
      const compSize = view.getUint32(offset + 20, true);
      const nameLen = view.getUint16(offset + 28, true);
      const extraLen = view.getUint16(offset + 30, true);
      const commentLen = view.getUint16(offset + 32, true);
      const localOffset = view.getUint32(offset + 42, true);
      const name = td.decode(bytes.subarray(offset + 46, offset + 46 + nameLen));
      offset += 46 + nameLen + extraLen + commentLen;

      if (name.endsWith('/') || name.startsWith('__MACOSX') || name.includes('.DS_Store')) continue;
      if (!/\.(json|txt)$/i.test(name)) continue;

      // Local file header: skip its own name/extra fields (may differ from central dir)
      const lNameLen = view.getUint16(localOffset + 26, true);
      const lExtraLen = view.getUint16(localOffset + 28, true);
      const dataStart = localOffset + 30 + lNameLen + lExtraLen;
      const raw = bytes.subarray(dataStart, dataStart + compSize);

      let data;
      if (method === 0) data = raw;
      else if (method === 8) data = await inflate(raw);
      else continue; // unsupported compression method
      files.set(name, td.decode(data));
    }
    return files;
  }

  return { readTextEntries };
})();
