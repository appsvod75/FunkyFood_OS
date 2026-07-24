import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const versionFile = path.join(__dirname, '..', 'public', 'version.json');

const raw = fs.readFileSync(versionFile, 'utf-8');
const data = JSON.parse(raw);
const base = String(data.version || '1.0.0').replace(/-\d{14}$/, '');
const now = new Date();
const stamp =
  String(now.getFullYear()) +
  String(now.getMonth() + 1).padStart(2, '0') +
  String(now.getDate()).padStart(2, '0') +
  String(now.getHours()).padStart(2, '0') +
  String(now.getMinutes()).padStart(2, '0') +
  String(now.getSeconds()).padStart(2, '0');

data.version = `${base}-${stamp}`;
fs.writeFileSync(versionFile, JSON.stringify(data, null, 4) + '\n', 'utf-8');
console.log(`📦 version.json → ${data.version}`);
