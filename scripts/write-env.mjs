import { existsSync, readFileSync, writeFileSync } from 'node:fs';

let apiUrl = 'http://localhost:8787';

if (existsSync('amplify_outputs.json')) {
  const outputs = JSON.parse(readFileSync('amplify_outputs.json', 'utf8'));
  const fromOutputs = outputs.custom?.apiUrl;
  if (typeof fromOutputs === 'string' && fromOutputs.length > 0) {
    apiUrl = fromOutputs.replace(/\/$/, '');
  }
}

writeFileSync('.env.production', `VITE_API_URL=${apiUrl}\n`);
