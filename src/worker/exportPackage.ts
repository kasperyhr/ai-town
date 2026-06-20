import { base64UrlEncode, bytesToUtf8, utf8ToBytes } from './crypto';
import type { Env } from './types';
import type { WorldExportData } from './worlds';

const MAGIC = utf8ToBytes('AITOWN1');
const IV_BYTES = 12;
const DATA_KEY_BITS = 256;
const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

interface EncryptedHeader {
  version: 1;
  masterKeyId: string;
  dataKey: string;
  createdAt: string;
}

export async function encryptWorldPackage(env: Env, data: WorldExportData): Promise<Uint8Array> {
  const masterKeys = await getMasterKeys(env);
  const current = masterKeys[0];
  if (!current) throw new Error('No export master key configured.');

  const dataKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: DATA_KEY_BITS }, true, ['encrypt', 'decrypt']);
  const rawDataKey = new Uint8Array(await crypto.subtle.exportKey('raw', dataKey));

  const header: EncryptedHeader = {
    version: 1,
    masterKeyId: current.id,
    dataKey: base64UrlEncode(rawDataKey),
    createdAt: new Date().toISOString(),
  };

  const headerIv = randomIv();
  const payloadIv = randomIv();
  const headerBytes = utf8ToBytes(JSON.stringify(header));
  const payloadBytes = utf8ToBytes(JSON.stringify(data));

  const encryptedHeader = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(headerIv), additionalData: toArrayBuffer(MAGIC) },
      current.key,
      toArrayBuffer(headerBytes),
    ),
  );
  const encryptedPayload = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(payloadIv), additionalData: toArrayBuffer(encryptedHeader) },
      dataKey,
      toArrayBuffer(payloadBytes),
    ),
  );

  return concatBytes(
    MAGIC,
    headerIv,
    uint32(encryptedHeader.length),
    encryptedHeader,
    payloadIv,
    uint32(encryptedPayload.length),
    encryptedPayload,
  );
}

export async function decryptWorldPackage(env: Env, bytes: Uint8Array): Promise<WorldExportData> {
  if (bytes.byteLength > MAX_IMPORT_BYTES) throw new Error('Import file is too large.');
  if (!startsWith(bytes, MAGIC)) throw new Error('Invalid export file.');

  let offset = MAGIC.length;
  const headerIv = bytes.slice(offset, offset + IV_BYTES);
  offset += IV_BYTES;
  const headerLength = readUint32(bytes, offset);
  offset += 4;
  const encryptedHeader = bytes.slice(offset, offset + headerLength);
  offset += headerLength;
  const payloadIv = bytes.slice(offset, offset + IV_BYTES);
  offset += IV_BYTES;
  const payloadLength = readUint32(bytes, offset);
  offset += 4;
  const encryptedPayload = bytes.slice(offset, offset + payloadLength);

  if (encryptedHeader.length !== headerLength || encryptedPayload.length !== payloadLength) {
    throw new Error('Truncated export file.');
  }

  const masterKeys = await getMasterKeys(env);
  for (const masterKey of masterKeys) {
    try {
      const headerBytes = new Uint8Array(
        await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: toArrayBuffer(headerIv), additionalData: toArrayBuffer(MAGIC) },
          masterKey.key,
          toArrayBuffer(encryptedHeader),
        ),
      );
      const header = JSON.parse(bytesToUtf8(headerBytes)) as EncryptedHeader;
      if (header.version !== 1 || !header.dataKey) throw new Error('Invalid header.');

      const dataKey = await crypto.subtle.importKey(
        'raw',
        toArrayBuffer(decodeBase64Url(header.dataKey)),
        { name: 'AES-GCM' },
        false,
        ['decrypt'],
      );
      const payloadBytes = new Uint8Array(
        await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: toArrayBuffer(payloadIv), additionalData: toArrayBuffer(encryptedHeader) },
          dataKey,
          toArrayBuffer(encryptedPayload),
        ),
      );
      return JSON.parse(bytesToUtf8(payloadBytes)) as WorldExportData;
    } catch {
      continue;
    }
  }

  throw new Error('No configured master key could decrypt this file.');
}

export function maxImportBytes(): number {
  return MAX_IMPORT_BYTES;
}

async function getMasterKeys(env: Env): Promise<Array<{ id: string; key: CryptoKey }>> {
  const parsed = JSON.parse(env.EXPORT_MASTER_KEYS_JSON) as Record<string, string>;
  const entries = Object.entries(parsed);
  if (entries.length === 0) throw new Error('EXPORT_MASTER_KEYS_JSON is empty.');

  const keys: Array<{ id: string; key: CryptoKey }> = [];
  for (const [id, secret] of entries) {
    if (!id || !secret || secret.startsWith('replace-')) continue;
    const keyMaterial = await crypto.subtle.importKey('raw', toArrayBuffer(utf8ToBytes(secret)), 'HKDF', false, [
      'deriveKey',
    ]);
    const key = await crypto.subtle.deriveKey(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: toArrayBuffer(utf8ToBytes('ai-town-lite-export-v1')),
        info: toArrayBuffer(utf8ToBytes(`master:${id}`)),
      },
      keyMaterial,
      { name: 'AES-GCM', length: DATA_KEY_BITS },
      false,
      ['encrypt', 'decrypt'],
    );
    keys.push({ id, key });
  }
  return keys;
}

function randomIv(): Uint8Array {
  const iv = new Uint8Array(IV_BYTES);
  crypto.getRandomValues(iv);
  return iv;
}

function uint32(value: number): Uint8Array {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, false);
  return bytes;
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0, false);
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function startsWith(bytes: Uint8Array, prefix: Uint8Array): boolean {
  if (bytes.length < prefix.length) return false;
  for (let i = 0; i < prefix.length; i += 1) {
    if (bytes[i] !== prefix[i]) return false;
  }
  return true;
}

function decodeBase64Url(value: string): Uint8Array {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
