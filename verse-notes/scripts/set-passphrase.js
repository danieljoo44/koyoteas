// Reset the login passphrase: node scripts/set-passphrase.js "new passphrase"
const crypto = require('crypto');
const { db } = require('../server/db');

const pass = process.argv[2];
if (!pass || pass.length < 8) {
  console.error('Usage: node scripts/set-passphrase.js "passphrase of at least 8 characters"');
  process.exit(1);
}
const salt = crypto.randomBytes(16).toString('hex');
const hash = crypto.scryptSync(pass, salt, 64).toString('hex');
const set = db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
set.run('pass_salt', salt);
set.run('pass_hash', hash);
db.prepare('DELETE FROM sessions').run();
console.log('Passphrase updated; all existing sessions logged out.');
