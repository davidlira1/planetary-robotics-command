import * as fs from 'fs';
import * as path from 'path';
import YAML from 'yaml';
import { generateOpenApiDocument } from './document';

const outPath = path.resolve(
  __dirname,
  '../../../../specs/openapi/openapi.v1.yaml',
);

if (!fs.existsSync(outPath)) {
  console.error(`Missing OpenAPI artifact at ${outPath}. Run openapi:export.`);
  process.exit(1);
}

const committed = fs.readFileSync(outPath, 'utf8');
const generated = YAML.stringify(generateOpenApiDocument());

if (committed !== generated) {
  console.error(
    'OpenAPI artifact drift detected. Run `pnpm openapi:export` and commit the result.',
  );
  process.exit(1);
}

console.log('OpenAPI artifact matches generated output.');
