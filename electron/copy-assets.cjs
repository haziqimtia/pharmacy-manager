const fs = require('node:fs');
const path = require('node:path');

const src = path.join(__dirname, 'db', 'schema.sql');
const destDir = path.join(__dirname, '..', 'dist-electron', 'db');
const dest = path.join(destDir, 'schema.sql');

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
console.log('Copied schema.sql -> dist-electron/db/schema.sql');
