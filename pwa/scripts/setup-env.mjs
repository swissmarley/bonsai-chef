// Creates .env from .env.example and fills in the generated secrets
// (AUTH_SECRET and the VAPID key pair). Existing values are never overwritten.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import webpush from 'web-push';

const ENV = '.env';
let text = existsSync(ENV) ? readFileSync(ENV, 'utf8') : readFileSync('.env.example', 'utf8');

const lineRe = (key) => new RegExp(`^${key}=(.*)$`, 'm');
const get = (key) => text.match(lineRe(key))?.[1].trim() ?? '';
function set(key, value) {
  text = lineRe(key).test(text) ? text.replace(lineRe(key), `${key}=${value}`) : `${text.trimEnd()}\n${key}=${value}\n`;
}

const generated = [];
if (!get('AUTH_SECRET')) {
  set('AUTH_SECRET', randomBytes(48).toString('base64url'));
  generated.push('AUTH_SECRET');
}
// The two VAPID keys only work as a pair: (re)generate both if either is missing.
if (!get('VAPID_PUBLIC_KEY') || !get('VAPID_PRIVATE_KEY')) {
  const vapid = webpush.generateVAPIDKeys();
  set('VAPID_PUBLIC_KEY', vapid.publicKey);
  set('VAPID_PRIVATE_KEY', vapid.privateKey);
  generated.push('VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY');
}

writeFileSync(ENV, text);
console.log(generated.length ? `.env updated: ${generated.join(', ')} generated.` : '.env already complete.');
console.log('\nTo use the same secrets on Netlify (from a linked site folder):');
for (const key of ['AUTH_SECRET', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY']) {
  console.log(`  npx netlify-cli env:set ${key} "$(grep '^${key}=' .env | cut -d= -f2-)"`);
}
console.log('');
