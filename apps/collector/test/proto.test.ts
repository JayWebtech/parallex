import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PROTO_DIR } from '../src/proto.js';

describe('vendored protos', () => {
  const sums = readFileSync(path.join(PROTO_DIR, 'SHA256SUMS'), 'utf8').trim().split('\n');

  it.each(sums.map((line) => line.split(/\s+/) as [string, string]))(
    '%s matches %s',
    (sha, file) => {
      const actual = createHash('sha256')
        .update(readFileSync(path.join(PROTO_DIR, file)))
        .digest('hex');
      expect(actual).toBe(sha);
    },
  );
});
