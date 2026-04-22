export interface KeywordFilterProfile {
  id: string;
  name: string;
  query: string;
  updatedAt: string;
}

export interface NewsKeywordMatchInput {
  title?: string | null;
  body?: string | null;
  publisher?: string | null;
  source?: string | null;
  sourceType?: string | null;
  originUrl?: string | null;
  url?: string | null;
  tickers?: string[] | string | null;
  keywords?: string[] | null;
}

type KeywordFilterTokenType = 'LPAREN' | 'RPAREN' | 'AND' | 'OR' | 'TERM' | 'EOF';

interface KeywordFilterToken {
  type: KeywordFilterTokenType;
  value?: string;
  position: number;
}

type KeywordFilterAst =
  | { type: 'term'; value: string }
  | { type: 'and'; children: KeywordFilterAst[] }
  | { type: 'or'; children: KeywordFilterAst[] };

export type KeywordFilterParseResult =
  | { ok: true; ast: KeywordFilterAst }
  | { ok: false; error: string };

class KeywordFilterParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KeywordFilterParseError';
  }
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function tokenizeKeywordFilter(rawQuery: string): KeywordFilterToken[] {
  const tokens: KeywordFilterToken[] = [];
  let index = 0;

  while (index < rawQuery.length) {
    const char = rawQuery[index];

    if (/\s/.test(char)) {
      index += 1;
      continue;
    }

    if (char === '(') {
      tokens.push({ type: 'LPAREN', position: index });
      index += 1;
      continue;
    }

    if (char === ')') {
      tokens.push({ type: 'RPAREN', position: index });
      index += 1;
      continue;
    }

    if (char === '"') {
      const start = index;
      index += 1;
      let phrase = '';

      while (index < rawQuery.length && rawQuery[index] !== '"') {
        phrase += rawQuery[index];
        index += 1;
      }

      if (index >= rawQuery.length) {
        throw new KeywordFilterParseError('닫히지 않은 따옴표가 있습니다.');
      }

      index += 1;
      const normalizedPhrase = normalizeText(phrase);
      if (!normalizedPhrase) {
        throw new KeywordFilterParseError('빈 따옴표 구문은 사용할 수 없습니다.');
      }

      tokens.push({ type: 'TERM', value: normalizedPhrase, position: start });
      continue;
    }

    const start = index;
    let word = '';
    while (index < rawQuery.length && !/\s/.test(rawQuery[index]) && rawQuery[index] !== '(' && rawQuery[index] !== ')') {
      word += rawQuery[index];
      index += 1;
    }

    const normalizedWord = normalizeText(word);
    if (!normalizedWord) {
      continue;
    }

    if (normalizedWord === 'or') {
      tokens.push({ type: 'OR', position: start });
      continue;
    }

    if (normalizedWord === 'and') {
      tokens.push({ type: 'AND', position: start });
      continue;
    }

    tokens.push({ type: 'TERM', value: normalizedWord, position: start });
  }

  tokens.push({ type: 'EOF', position: rawQuery.length });
  return tokens;
}

class KeywordFilterParser {
  private cursor = 0;

  constructor(private readonly tokens: KeywordFilterToken[]) {}

  parse(): KeywordFilterAst {
    const ast = this.parseOr();
    const next = this.peek();
    if (next.type !== 'EOF') {
      if (next.type === 'RPAREN') {
        throw new KeywordFilterParseError('불필요한 닫는 괄호가 있습니다.');
      }
      throw new KeywordFilterParseError('검색식을 끝까지 해석하지 못했습니다.');
    }
    return ast;
  }

  private parseOr(): KeywordFilterAst {
    const children: KeywordFilterAst[] = [this.parseAnd()];

    while (this.peek().type === 'OR') {
      this.consume();
      if (!this.canStartPrimary(this.peek())) {
        throw new KeywordFilterParseError('`OR` 뒤에 검색어가 필요합니다.');
      }
      children.push(this.parseAnd());
    }

    return children.length === 1 ? children[0] : { type: 'or', children };
  }

  private parseAnd(): KeywordFilterAst {
    const children: KeywordFilterAst[] = [];
    let explicitAndPending = false;

    while (true) {
      const next = this.peek();

      if (next.type === 'AND') {
        if (children.length === 0 || explicitAndPending) {
          throw new KeywordFilterParseError('`AND` 앞뒤에 검색어가 필요합니다.');
        }
        this.consume();
        explicitAndPending = true;
        continue;
      }

      if (!this.canStartPrimary(next)) {
        break;
      }

      children.push(this.parsePrimary());
      explicitAndPending = false;

      const afterPrimary = this.peek();
      if (afterPrimary.type === 'OR' || afterPrimary.type === 'RPAREN' || afterPrimary.type === 'EOF') {
        break;
      }
    }

    if (children.length === 0) {
      throw new KeywordFilterParseError('검색어가 비어 있습니다.');
    }

    if (explicitAndPending) {
      throw new KeywordFilterParseError('`AND` 뒤에 검색어가 필요합니다.');
    }

    return children.length === 1 ? children[0] : { type: 'and', children };
  }

  private parsePrimary(): KeywordFilterAst {
    const next = this.peek();

    if (next.type === 'LPAREN') {
      this.consume();
      if (this.peek().type === 'RPAREN') {
        throw new KeywordFilterParseError('빈 괄호는 사용할 수 없습니다.');
      }
      const expr = this.parseOr();
      if (this.peek().type !== 'RPAREN') {
        throw new KeywordFilterParseError('괄호가 닫히지 않았습니다.');
      }
      this.consume();
      return expr;
    }

    if (next.type === 'TERM') {
      this.consume();
      return { type: 'term', value: next.value ?? '' };
    }

    throw new KeywordFilterParseError('검색어가 필요합니다.');
  }

  private canStartPrimary(token: KeywordFilterToken): boolean {
    return token.type === 'LPAREN' || token.type === 'TERM';
  }

  private peek(): KeywordFilterToken {
    return this.tokens[this.cursor] ?? this.tokens[this.tokens.length - 1];
  }

  private consume(): KeywordFilterToken {
    const token = this.peek();
    this.cursor += 1;
    return token;
  }
}

export function parseKeywordFilterExpression(rawQuery: string): KeywordFilterParseResult {
  const trimmedQuery = rawQuery.trim();
  if (!trimmedQuery) {
    return { ok: false, error: 'Exclude query is required.' };
  }

  try {
    const parser = new KeywordFilterParser(tokenizeKeywordFilter(trimmedQuery));
    return { ok: true, ast: parser.parse() };
  } catch (error) {
    if (error instanceof KeywordFilterParseError) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: 'Invalid keyword filter query.' };
  }
}

export function matchesKeywordFilterAst(ast: KeywordFilterAst, searchableText: string): boolean {
  const normalizedText = normalizeText(searchableText);

  switch (ast.type) {
    case 'term':
      return normalizedText.includes(ast.value);
    case 'and':
      return ast.children.every((child) => matchesKeywordFilterAst(child, normalizedText));
    case 'or':
      return ast.children.some((child) => matchesKeywordFilterAst(child, normalizedText));
    default:
      return false;
  }
}

export function buildNewsKeywordMatchText(input: NewsKeywordMatchInput): string {
  const tickerText = Array.isArray(input.tickers)
    ? input.tickers.filter(Boolean).join(' ')
    : input.tickers ?? '';

  const keywordText = Array.isArray(input.keywords)
    ? input.keywords.filter(Boolean).join(' ')
    : '';

  return normalizeText([
    input.title,
    input.body,
    input.publisher,
    input.source,
    input.sourceType,
    input.originUrl,
    input.url,
    tickerText,
    keywordText,
  ].filter((part): part is string => Boolean(part && part.trim())).join(' '));
}