import { buildSnippet } from '@parallax/tracker';
import { describe, expect, it } from 'vitest';
import type { CodeLanguage, Token } from '@/lib/highlight';
import { highlight, prettyTag } from '@/lib/highlight';
import { collectorConfig, nodeEnvSnippet } from '@/lib/instrument';

const join = (lines: Token[][]) => lines.map((l) => l.map((t) => t.text).join('')).join('\n');
const kinds = (lines: Token[][], kind: Token['kind']) =>
  lines
    .flat()
    .filter((t) => t.kind === kind)
    .map((t) => t.text);

const snippet = buildSnippet({
  origin: 'https://parallax.example.org',
  websiteId: '7da3c9db-8e41-449d-8b9d-ea2680e93701',
});

describe('highlight', () => {
  it.each<[CodeLanguage, string]>([
    ['html', prettyTag(snippet)],
    ['shell', nodeEnvSnippet('https://parallax.example.org')],
    ['yaml', collectorConfig()],
    ['shell', 'curl -H "Authorization: Bearer $KEY" \\\n  "https://x.example.org/api?range=30d"'],
    ['text', 'plx_in_abc\n\nsecond'],
  ])('never changes the text (%s)', (language, code) => {
    expect(join(highlight(code, language))).toBe(code);
  });

  it('colors the HTML snippet by tag, attribute and value', () => {
    const lines = highlight(prettyTag(snippet), 'html');
    expect(kinds(lines, 'tag')).toEqual(['script', 'script']);
    expect(kinds(lines, 'attr')).toContain('integrity');
    expect(kinds(lines, 'string')).toContain('"anonymous"');
  });

  it('marks env keys, comments and the placeholder to replace', () => {
    const lines = highlight(nodeEnvSnippet('https://p.example.org'), 'shell');
    expect(kinds(lines, 'key')).toContain('OTEL_EXPORTER_OTLP_METRICS_HEADERS');
    expect(kinds(lines, 'comment')[0]).toMatch(/^# Metrics/);
    expect(kinds(lines, 'placeholder')).toContain('<your-ingest-key>');
  });

  it('marks YAML keys and ${env:…} placeholders', () => {
    const lines = highlight(collectorConfig(), 'yaml');
    expect(kinds(lines, 'key')).toEqual(expect.arrayContaining(['receivers', 'exporters']));
    expect(kinds(lines, 'placeholder')).toContain('${env:PARALLAX_INGEST_KEY}');
  });

  it('marks the command, flags and variables in a shell command', () => {
    const lines = highlight('curl -H "Authorization: Bearer $KEY" "https://x"', 'shell');
    expect(kinds(lines, 'command')).toEqual(['curl']);
    expect(kinds(lines, 'flag')).toEqual(['-H']);
    expect(kinds(lines, 'placeholder')).toEqual(['$KEY']);
  });
});

describe('prettyTag', () => {
  it('puts one attribute per line and keeps every attribute', () => {
    const pretty = prettyTag(snippet);
    expect(pretty.split('\n')[0]).toBe('<script');
    expect(pretty.split('\n').at(-1)).toBe('></script>');
    expect(pretty.replace(/\n\s*/g, ' ').replace(' ></', '></')).toBe(snippet);
  });

  it('leaves anything else untouched', () => {
    expect(prettyTag('<div><b>x</b></div>')).toBe('<div><b>x</b></div>');
  });
});
