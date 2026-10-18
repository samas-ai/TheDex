import path from 'node:path';
import {
  DATA_DB_FILE,
  DIST_DIR,
  POKEAPI_CSV_DIR,
  SIZE_FAIL_BYTES,
  SIZE_WARN_BYTES,
} from '../config';
import { validateDatabase } from '../validate';

const report = await validateDatabase({
  dbFile: path.join(DIST_DIR, DATA_DB_FILE),
  csvDir: POKEAPI_CSV_DIR,
  sizeWarnBytes: SIZE_WARN_BYTES,
  sizeFailBytes: SIZE_FAIL_BYTES,
});

for (const name of report.passed) console.log(`  ✓ ${name}`);
for (const warning of report.warnings) console.warn(`  ! ${warning}`);
for (const error of report.errors) console.error(`  ✗ ${error}`);
console.log(
  `\n${report.passed.length} passed, ${report.warnings.length} warnings, ${report.errors.length} errors`,
);
if (report.errors.length > 0) process.exitCode = 1;
