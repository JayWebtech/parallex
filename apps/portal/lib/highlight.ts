/**
 * A tiny syntax highlighter for the few formats the portal shows: the HTML
 * tracking snippet, environment files / shell commands, and YAML (collector
 * config). No dependency, no regex backtracking traps; joining every token's
 * text always gives back the input exactly.
 */
export type TokenKind =
  | 'punct'
  | 'tag'
  | 'attr'
  | 'string'
  | 'comment'
  | 'key'
  | 'number'
  | 'command'
  | 'flag'
  /** Something the reader must replace: <your-key>, ${env:X}, $VAR. */
  | 'placeholder';

export interface Token {
  text: string;
  kind?: TokenKind;
}

export type CodeLanguage = 'html' | 'shell' | 'yaml' | 'text';

const PLACEHOLDER = /(<[a-z][\w-]*>|\$\{[^}\n]+\}|\$[A-Z_][A-Z0-9_]*)/;

/** Splits plain text, marking placeholders inside it (odd split parts are the matches). */
function withPlaceholders(text: string, kind?: TokenKind): Token[] {
  return text
    .split(PLACEHOLDER)
    .map((part, i): Token =>
      i % 2 === 1 ? { text: part, kind: 'placeholder' } : { text: part, ...(kind ? { kind } : {}) },
    )
    .filter((t) => t.text !== '');
}

function html(code: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < code.length) {
    const open = code.indexOf('<', i);
    if (open === -1) {
      out.push({ text: code.slice(i) });
      break;
    }
    if (open > i) out.push({ text: code.slice(i, open) });
    const close = code.indexOf('>', open);
    const end = close === -1 ? code.length : close + 1;
    out.push(...htmlTag(code.slice(open, end)));
    i = end;
  }
  return out;
}

function htmlTag(tag: string): Token[] {
  const out: Token[] = [];
  const m = /^(<\/?)([\w-]*)/.exec(tag)!;
  out.push({ text: m[1]!, kind: 'punct' });
  if (m[2]) out.push({ text: m[2], kind: 'tag' });
  const re = /(\s+)|([\w:-]+)|(=)|("[^"]*"?)|(\/?>)|(.)/gy;
  re.lastIndex = m[0].length;
  let t: RegExpExecArray | null;
  while ((t = re.exec(tag))) {
    if (t[1]) out.push({ text: t[1] });
    else if (t[2]) out.push({ text: t[2], kind: 'attr' });
    else if (t[3]) out.push({ text: t[3], kind: 'punct' });
    else if (t[4]) out.push({ text: t[4], kind: 'string' });
    else if (t[5]) out.push({ text: t[5], kind: 'punct' });
    else out.push({ text: t[6]! });
  }
  return out;
}

function shellLine(line: string): Token[] {
  if (/^\s*#/.test(line)) return [{ text: line, kind: 'comment' }];
  const env = /^(\s*)([A-Za-z_][A-Za-z0-9_]*)(=)(.*)$/.exec(line);
  if (env) {
    const [, indent, key, eq, value] = env;
    return [
      ...(indent ? [{ text: indent }] : []),
      { text: key!, kind: 'key' as const },
      { text: eq!, kind: 'punct' as const },
      ...shellWords(value!, false),
    ];
  }
  return shellWords(line, true);
}

/** Words of a command line: the command, flags, quoted strings, placeholders. */
function shellWords(text: string, isCommand: boolean): Token[] {
  const out: Token[] = [];
  const re = /(\s+)|("(?:[^"\\]|\\.)*"?|'[^']*'?)|(\\$)|([^\s"']+)/gy;
  let first = isCommand;
  let t: RegExpExecArray | null;
  while ((t = re.exec(text))) {
    if (t[1]) out.push({ text: t[1] });
    else if (t[2]) out.push(...withPlaceholders(t[2], 'string'));
    else if (t[3]) out.push({ text: t[3], kind: 'punct' });
    else if (t[4]) {
      const word = t[4];
      if (first) out.push({ text: word, kind: 'command' });
      else if (/^--?[\w-]+$/.test(word)) out.push({ text: word, kind: 'flag' });
      else out.push(...withPlaceholders(word));
      first = false;
    }
  }
  return out;
}

function yamlLine(line: string): Token[] {
  const comment = /^(\s*)(#.*)$/.exec(line);
  if (comment)
    return [...(comment[1] ? [{ text: comment[1] }] : []), { text: comment[2]!, kind: 'comment' }];
  const out: Token[] = [];
  const m = /^(\s*)(- )?([\w./@-]+)(:)(?=\s|$)/.exec(line);
  let rest = line;
  if (m) {
    if (m[1]) out.push({ text: m[1] });
    if (m[2]) out.push({ text: m[2], kind: 'punct' });
    out.push({ text: m[3]!, kind: 'key' }, { text: m[4]!, kind: 'punct' });
    rest = line.slice(m[0].length);
  } else {
    const dash = /^(\s*)(- )/.exec(line);
    if (dash) {
      if (dash[1]) out.push({ text: dash[1] });
      out.push({ text: dash[2]!, kind: 'punct' });
      rest = line.slice(dash[0].length);
    }
  }
  // Trailing comment (a # preceded by whitespace).
  const hash = rest.search(/\s#/);
  const value = hash === -1 ? rest : rest.slice(0, hash);
  const trailing = hash === -1 ? '' : rest.slice(hash);
  const lead = /^\s*/.exec(value)![0];
  const body = value.slice(lead.length);
  if (lead) out.push({ text: lead });
  if (body) {
    if (/^["'].*["']$/.test(body.trimEnd())) out.push(...withPlaceholders(body, 'string'));
    else if (/^(-?\d+(\.\d+)?|true|false|null)\s*$/.test(body))
      out.push({ text: body, kind: 'number' });
    else if (/^\[.*\]\s*$/.test(body)) {
      for (const part of body.split(/([[\],])/).filter(Boolean)) {
        if (/^[[\],]$/.test(part)) out.push({ text: part, kind: 'punct' });
        else out.push(...withPlaceholders(part));
      }
    } else out.push(...withPlaceholders(body));
  }
  if (trailing) out.push({ text: trailing, kind: 'comment' });
  return out;
}

/** Tokens per line (line breaks are not included). */
export function highlight(code: string, language: CodeLanguage): Token[][] {
  if (language === 'html') {
    // Tags may span lines: tokenize once, then cut at line breaks.
    const lines: Token[][] = [[]];
    for (const token of html(code)) {
      token.text.split('\n').forEach((part, i) => {
        if (i > 0) lines.push([]);
        if (part) lines[lines.length - 1]!.push({ ...token, text: part });
      });
    }
    return lines;
  }
  return code.split('\n').map((line) => {
    if (language === 'shell') return shellLine(line);
    if (language === 'yaml') return yamlLine(line);
    return line ? [{ text: line }] : [];
  });
}

/**
 * One attribute per line, the way snippets are usually shown in docs:
 *   <script
 *     defer
 *     src="…"
 *   ></script>
 * Only reformats a single opening tag followed by its closing tag.
 */
export function prettyTag(snippet: string): string {
  const m = /^<([\w-]+)((?:\s+[\w:-]+(?:="[^"]*")?)*)\s*>(<\/\1>)?$/.exec(snippet.trim());
  if (!m) return snippet;
  const attrs = m[2]!.trim().match(/[\w:-]+(?:="[^"]*")?/g) ?? [];
  return [`<${m[1]}`, ...attrs.map((a) => `  ${a}`), `>${m[3] ?? ''}`].join('\n');
}
