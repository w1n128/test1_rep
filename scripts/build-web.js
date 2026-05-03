const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'www');
const entries = ['index.html', 'style.css', 'src', 'assets'];

function shouldCopy(name) {
  return name !== '.DS_Store' && name !== 'Thumbs.db';
}

function copyEntry(from, to) {
  const stat = fs.statSync(from);
  if (stat.isDirectory()) {
    fs.mkdirSync(to, { recursive: true });
    for (const child of fs.readdirSync(from)) {
      if (shouldCopy(child)) copyEntry(path.join(from, child), path.join(to, child));
    }
    return;
  }
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

for (const entry of entries) {
  const from = path.join(root, entry);
  if (fs.existsSync(from)) copyEntry(from, path.join(out, entry));
}

console.log('Built web assets into www/');
