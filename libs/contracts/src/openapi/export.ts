import * as fs from 'fs';
import * as path from 'path';
import YAML from 'yaml';
import { generateOpenApiDocument } from './document';

const doc = generateOpenApiDocument();
const outPath = path.resolve(
  __dirname,
  '../../../../specs/openapi/openapi.v1.yaml',
);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, YAML.stringify(doc), 'utf8');
console.log(`Wrote ${outPath}`);
