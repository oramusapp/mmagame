#!/usr/bin/env node
// Szyfruje dane startowe (JSON z tools/xlsx_to_seed.py) hasłem aplikacji.
// Użycie: SDCA_PASSWORD='...' node tools/encrypt_seed.mjs <seed.json> seed.enc.js
// AES-GCM 256, klucz z hasła przez PBKDF2-SHA256. Hasło nie trafia do repozytorium.
import { readFileSync, writeFileSync } from 'node:fs';
import { webcrypto as crypto } from 'node:crypto';

const ITER = 310000;
const [, , input, output] = process.argv;
const password = process.env.SDCA_PASSWORD;
if (!input || !output || !password) {
  console.error("Użycie: SDCA_PASSWORD='...' node tools/encrypt_seed.mjs <seed.json> <seed.enc.js>");
  process.exit(1);
}

const b64 = (buf) => Buffer.from(buf).toString('base64');
const plain = JSON.stringify(JSON.parse(readFileSync(input, 'utf8')));
const salt = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));
const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plain));
const blob = { v: 1, kdf: 'PBKDF2-SHA256', iter: ITER, salt: b64(salt), iv: b64(iv), ct: b64(ct) };
writeFileSync(output, `// Zaszyfrowane dane startowe SDCA (AES-GCM + PBKDF2). Wygenerowane przez tools/encrypt_seed.mjs.\nwindow.SDCA_SEED_ENC = ${JSON.stringify(blob)};\n`);
console.log(`Zapisano ${output} (${plain.length} B danych)`);
