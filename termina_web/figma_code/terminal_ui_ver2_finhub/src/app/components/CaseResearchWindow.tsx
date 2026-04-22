import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Search, Trash2, Copy, FileText, FolderOpen, Check, RefreshCw, RotateCcw, X } from 'lucide-react';

const API_BASE = '';
const HIGHLIGHT_CLOSE_TOKEN = '[[/hl]]';
const HIGHLIGHT_OPEN_PATTERN = /\[\[hl=(#[0-9A-Fa-f]{6})\]\]/g;
const HIGHLIGHT_BLOCK_PATTERN = /\[\[hl=(#[0-9A-Fa-f]{6})\]\]([\s\S]*?)\[\[\/hl\]\]/g;
const HIGHLIGHT_TOKEN_PATTERN = /\[\[hl=#[0-9A-Fa-f]{6}\]\]|\[\[\/hl\]\]/g;

const HIGHLIGHT_PRESETS = [
  { label: 'Amber', value: '#FDE68A' },
  { label: 'Mint', value: '#BBF7D0' },
  { label: 'Sky', value: '#BAE6FD' },
  { label: 'Rose', value: '#FDA4AF' },
  { label: 'Lavender', value: '#DDD6FE' },
];

const EDITOR_MONO_FONT_FAMILY = '"D2Coding", "NanumGothicCoding", "Noto Sans Mono CJK KR", "GulimChe", Consolas, "Liberation Mono", "Courier New", monospace';

// ── Types ──

interface ResearchTab {
  id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

interface ResearchPage {
  id: string;
  tab_id: string;
  title: string;
  body: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface SearchResult extends ResearchPage {
  tab_name: string;
}

interface ContextMenuState {
  type: 'tab' | 'page';
  id: string;
  x: number;
  y: number;
}

interface TrashedResearchTab extends ResearchTab {
  deleted_at: string;
}

interface TrashedResearchPage extends ResearchPage {
  deleted_at: string;
  tab_name: string | null;
  tab_deleted_at: string | null;
}

interface ResearchTrashResponse {
  tabs: TrashedResearchTab[];
  pages: TrashedResearchPage[];
}

interface EditorSelectionRange {
  start: number;
  end: number;
}

interface HighlightRange {
  start: number;
  end: number;
  color: string;
}

interface EditorDocument {
  text: string;
  highlights: HighlightRange[];
}

interface EditorSnapshot {
  document: EditorDocument;
  selection: EditorSelectionRange;
}

type EditorViewMode = 'edit' | 'split' | 'preview';
type TableAlignment = 'left' | 'center' | 'right';

interface PreviewTextLine {
  text: string;
  start: number;
  end: number;
}

interface ParsedMarkdownTableCell {
  text: string;
  start: number;
  end: number;
}

interface ParsedMarkdownTableRow {
  cells: ParsedMarkdownTableCell[];
}

interface MarkdownTableBlock {
  start: number;
  end: number;
  lines: PreviewTextLine[];
}

function normalizeHighlightColor(value: string): string {
  const trimmed = value.trim().toUpperCase();
  return /^#[0-9A-F]{6}$/.test(trimmed) ? trimmed : HIGHLIGHT_PRESETS[0].value;
}

function stripHighlightMarkup(value: string): string {
  const parsed = parseEditorDocument(value);
  return parsed.text;
}

function normalizeSelectionRange(range: EditorSelectionRange): EditorSelectionRange {
  return range.start <= range.end ? range : { start: range.end, end: range.start };
}

function cloneHighlightRanges(ranges: HighlightRange[]): HighlightRange[] {
  return ranges.map(range => ({ ...range }));
}

function cloneEditorDocument(document: EditorDocument): EditorDocument {
  return {
    text: document.text,
    highlights: cloneHighlightRanges(document.highlights),
  };
}

function cloneEditorSnapshot(snapshot: EditorSnapshot): EditorSnapshot {
  return {
    document: cloneEditorDocument(snapshot.document),
    selection: { ...snapshot.selection },
  };
}

function areEditorDocumentsEqual(left: EditorDocument, right: EditorDocument): boolean {
  if (left.text !== right.text || left.highlights.length !== right.highlights.length) {
    return false;
  }
  for (let index = 0; index < left.highlights.length; index += 1) {
    const leftRange = left.highlights[index];
    const rightRange = right.highlights[index];
    if (
      leftRange.start !== rightRange.start ||
      leftRange.end !== rightRange.end ||
      leftRange.color !== rightRange.color
    ) {
      return false;
    }
  }
  return true;
}

function normalizeHighlightRanges(ranges: HighlightRange[], textLength: number): HighlightRange[] {
  const sorted = ranges
    .map(range => ({
      start: Math.max(0, Math.min(textLength, range.start)),
      end: Math.max(0, Math.min(textLength, range.end)),
      color: normalizeHighlightColor(range.color),
    }))
    .filter(range => range.end > range.start)
    .sort((left, right) => left.start - right.start || left.end - right.end);

  const merged: HighlightRange[] = [];
  for (const range of sorted) {
    const previous = merged[merged.length - 1];
    if (previous && previous.color === range.color && range.start <= previous.end) {
      previous.end = Math.max(previous.end, range.end);
      continue;
    }
    if (previous && previous.color === range.color && range.start === previous.end) {
      previous.end = range.end;
      continue;
    }
    merged.push({ ...range });
  }
  return merged;
}

function parseEditorDocument(body: string): EditorDocument {
  const textParts: string[] = [];
  const highlights: HighlightRange[] = [];
  let rawCursor = 0;
  let textCursor = 0;
  let match: RegExpExecArray | null;

  HIGHLIGHT_BLOCK_PATTERN.lastIndex = 0;
  while ((match = HIGHLIGHT_BLOCK_PATTERN.exec(body)) !== null) {
    const [fullMatch, color, content] = match;
    const prefix = body.slice(rawCursor, match.index);
    textParts.push(prefix);
    textCursor += prefix.length;

    if (content.length > 0) {
      highlights.push({
        start: textCursor,
        end: textCursor + content.length,
        color: normalizeHighlightColor(color),
      });
    }
    textParts.push(content);
    textCursor += content.length;
    rawCursor = match.index + fullMatch.length;
  }

  if (rawCursor < body.length) {
    textParts.push(body.slice(rawCursor));
  }

  const text = textParts.join('');
  return {
    text,
    highlights: normalizeHighlightRanges(highlights, text.length),
  };
}

function serializeEditorDocument(document: EditorDocument): string {
  const normalizedHighlights = normalizeHighlightRanges(document.highlights, document.text.length);
  const output: string[] = [];
  let cursor = 0;

  for (const range of normalizedHighlights) {
    if (range.start > cursor) {
      output.push(document.text.slice(cursor, range.start));
    }
    output.push(`[[hl=${range.color}]]`);
    output.push(document.text.slice(range.start, range.end));
    output.push(HIGHLIGHT_CLOSE_TOKEN);
    cursor = range.end;
  }

  if (cursor < document.text.length) {
    output.push(document.text.slice(cursor));
  }

  return output.join('');
}

function getContrastTextColor(hexColor: string): string {
  const normalized = normalizeHighlightColor(hexColor).slice(1);
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
  return luminance > 0.6 ? '#0F172A' : '#F8FAFC';
}

function renderHighlightedText(text: string, ranges: HighlightRange[]): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const highlights = normalizeHighlightRanges(ranges, text.length);
  let cursor = 0;

  for (const range of highlights) {
    if (range.start > cursor) {
      nodes.push(text.slice(cursor, range.start));
    }
    nodes.push(
      <span
        key={`${range.start}-${range.end}-${range.color}`}
        className="rounded px-0.5 py-px"
        style={{ backgroundColor: normalizeHighlightColor(range.color), color: getContrastTextColor(range.color) }}
      >
        {text.slice(range.start, range.end)}
      </span>,
    );
    cursor = range.end;
  }

  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }

  return nodes;
}

function sliceHighlightRanges(ranges: HighlightRange[], start: number, end: number): HighlightRange[] {
  return normalizeHighlightRanges(
    ranges
      .filter(range => range.end > start && range.start < end)
      .map(range => ({
        start: Math.max(0, range.start - start),
        end: Math.min(end, range.end) - start,
        color: range.color,
      })),
    Math.max(0, end - start),
  );
}

function splitPreviewTextLines(text: string): PreviewTextLine[] {
  if (text.length === 0) {
    return [{ text: '', start: 0, end: 0 }];
  }

  const lines: PreviewTextLine[] = [];
  let lineStart = 0;

  for (let index = 0; index <= text.length; index += 1) {
    if (index === text.length || text[index] === '\n') {
      lines.push({
        text: text.slice(lineStart, index),
        start: lineStart,
        end: index,
      });
      lineStart = index + 1;
    }
  }

  return lines;
}

function findPreviewLineIndexAtOffset(lines: PreviewTextLine[], offset: number): number {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (offset <= line.end || index === lines.length - 1) {
      return index;
    }
  }
  return Math.max(0, lines.length - 1);
}

function isPotentialMarkdownTableLine(lineText: string): boolean {
  const trimmed = lineText.trim();
  return trimmed.length > 0 && trimmed.includes('|');
}

function countMonospaceColumns(value: string): number {
  return Array.from(value).length;
}

function buildMarkdownSeparatorCell(width: number, alignment: TableAlignment): string {
  if (alignment === 'right') {
    const totalWidth = Math.max(width, 4);
    return `${'-'.repeat(Math.max(3, totalWidth - 1))}:`;
  }
  if (alignment === 'center') {
    const totalWidth = Math.max(width, 5);
    return `:${'-'.repeat(Math.max(3, totalWidth - 2))}:`;
  }
  return '-'.repeat(Math.max(width, 3));
}

function padMarkdownTableCell(value: string, width: number, alignment: TableAlignment): string {
  const normalizedValue = value.trim();
  const diff = Math.max(0, width - countMonospaceColumns(normalizedValue));
  if (diff === 0) {
    return normalizedValue;
  }
  if (alignment === 'right') {
    return `${' '.repeat(diff)}${normalizedValue}`;
  }
  if (alignment === 'center') {
    const left = Math.floor(diff / 2);
    const right = diff - left;
    return `${' '.repeat(left)}${normalizedValue}${' '.repeat(right)}`;
  }
  return `${normalizedValue}${' '.repeat(diff)}`;
}

function formatMarkdownTableBlock(block: MarkdownTableBlock): string | null {
  if (block.lines.length < 2) {
    return null;
  }

  const parsedRows = block.lines.map(line => parseMarkdownTableRow(line.text, line.start));
  const headerRow = parsedRows[0];
  const separatorRow = parsedRows[1];
  const alignments = separatorRow ? parseMarkdownTableAlignments(separatorRow) : null;

  if (!headerRow || !separatorRow || !alignments) {
    return null;
  }

  const bodyRows = parsedRows.slice(2);
  if (bodyRows.some(row => row == null)) {
    return null;
  }

  const rows = [headerRow, ...bodyRows as ParsedMarkdownTableRow[]];
  const columnCount = Math.max(
    alignments.length,
    ...rows.map(row => row.cells.length),
  );
  const normalizedAlignments = Array.from({ length: columnCount }, (_, index) => alignments[index] ?? 'left');
  const matrix = rows.map(row => Array.from({ length: columnCount }, (_, index) => row.cells[index]?.text ?? ''));
  const widths = Array.from({ length: columnCount }, (_, columnIndex) => {
    const contentWidth = Math.max(...matrix.map(row => countMonospaceColumns(row[columnIndex])));
    return countMonospaceColumns(buildMarkdownSeparatorCell(contentWidth, normalizedAlignments[columnIndex]));
  });
  const baseIndent = block.lines[0].text.match(/^\s*/)?.[0] ?? '';
  const formatRow = (cells: string[]) => `${baseIndent}| ${cells.map((cell, index) => padMarkdownTableCell(cell, widths[index], normalizedAlignments[index])).join(' | ')} |`;
  const separatorLine = `${baseIndent}| ${widths.map((width, index) => buildMarkdownSeparatorCell(width, normalizedAlignments[index])).join(' | ')} |`;

  return [
    formatRow(matrix[0]),
    separatorLine,
    ...matrix.slice(1).map(formatRow),
  ].join('\n');
}

function collectMarkdownTableBlocks(text: string, start: number, end: number): MarkdownTableBlock[] {
  const lines = splitPreviewTextLines(text);
  if (lines.length === 0) {
    return [];
  }

  const collapsed = start === end;
  if (collapsed) {
    const lineIndex = findPreviewLineIndexAtOffset(lines, start);
    if (!isPotentialMarkdownTableLine(lines[lineIndex]?.text ?? '')) {
      return [];
    }
    let blockStart = lineIndex;
    let blockEnd = lineIndex;
    while (blockStart > 0 && isPotentialMarkdownTableLine(lines[blockStart - 1].text)) {
      blockStart -= 1;
    }
    while (blockEnd + 1 < lines.length && isPotentialMarkdownTableLine(lines[blockEnd + 1].text)) {
      blockEnd += 1;
    }
    return [{
      start: lines[blockStart].start,
      end: lines[blockEnd].end,
      lines: lines.slice(blockStart, blockEnd + 1),
    }];
  }

  const startLineIndex = findPreviewLineIndexAtOffset(lines, start);
  const endLineIndex = findPreviewLineIndexAtOffset(lines, Math.max(start, end - 1));
  const blocks: MarkdownTableBlock[] = [];
  let index = startLineIndex;

  while (index <= endLineIndex) {
    if (!isPotentialMarkdownTableLine(lines[index].text)) {
      index += 1;
      continue;
    }

    const blockStart = index;
    while (index + 1 <= endLineIndex && isPotentialMarkdownTableLine(lines[index + 1].text)) {
      index += 1;
    }
    const blockEnd = index;
    blocks.push({
      start: lines[blockStart].start,
      end: lines[blockEnd].end,
      lines: lines.slice(blockStart, blockEnd + 1),
    });
    index += 1;
  }

  return blocks;
}

function formatMarkdownTablesInSelection(
  text: string,
  start: number,
  end: number,
): { text: string; selection: EditorSelectionRange } | null {
  const blocks = collectMarkdownTableBlocks(text, start, end);
  if (blocks.length === 0) {
    return null;
  }

  let nextText = text;
  const replacements = blocks
    .map(block => ({ block, formatted: formatMarkdownTableBlock(block) }))
    .filter((entry): entry is { block: MarkdownTableBlock; formatted: string } => entry.formatted != null)
    .sort((left, right) => right.block.start - left.block.start);

  if (replacements.length === 0) {
    return null;
  }

  const updatedRanges: Array<{ start: number; end: number }> = [];
  for (const { block, formatted } of replacements) {
    nextText = `${nextText.slice(0, block.start)}${formatted}${nextText.slice(block.end)}`;
    updatedRanges.push({ start: block.start, end: block.start + formatted.length });
  }

  const normalizedRanges = updatedRanges.sort((left, right) => left.start - right.start);
  return {
    text: nextText,
    selection: {
      start: normalizedRanges[0].start,
      end: normalizedRanges[normalizedRanges.length - 1].end,
    },
  };
}

function parseMarkdownTableRow(lineText: string, lineStart: number): ParsedMarkdownTableRow | null {
  const leadingWhitespaceLength = lineText.match(/^\s*/)?.[0].length ?? 0;
  const trimmedLine = lineText.trim();
  if (!trimmedLine.includes('|')) {
    return null;
  }

  let working = lineText.slice(leadingWhitespaceLength);
  let baseOffset = lineStart + leadingWhitespaceLength;
  if (working.startsWith('|')) {
    working = working.slice(1);
    baseOffset += 1;
  }
  if (working.endsWith('|')) {
    working = working.slice(0, -1);
  }

  const rawCells = working.split('|');
  if (rawCells.length < 2) {
    return null;
  }

  const cells: ParsedMarkdownTableCell[] = [];
  let cellOffset = 0;

  for (const rawCell of rawCells) {
    const leading = rawCell.match(/^\s*/)?.[0].length ?? 0;
    const trailing = rawCell.match(/\s*$/)?.[0].length ?? 0;
    const trimmedCell = rawCell.trim();
    const start = baseOffset + cellOffset + leading;
    const end = Math.max(start, baseOffset + cellOffset + rawCell.length - trailing);
    cells.push({ text: trimmedCell, start, end });
    cellOffset += rawCell.length + 1;
  }

  return { cells };
}

function parseMarkdownTableAlignments(row: ParsedMarkdownTableRow): TableAlignment[] | null {
  if (row.cells.length === 0) {
    return null;
  }

  const alignments: TableAlignment[] = [];
  for (const cell of row.cells) {
    const token = cell.text.replace(/\s+/g, '');
    if (!/^:?-{3,}:?$/.test(token)) {
      return null;
    }
    const hasLeadingColon = token.startsWith(':');
    const hasTrailingColon = token.endsWith(':');
    if (hasLeadingColon && hasTrailingColon) {
      alignments.push('center');
    } else if (hasTrailingColon) {
      alignments.push('right');
    } else {
      alignments.push('left');
    }
  }

  return alignments;
}

function renderPreviewContent(text: string, ranges: HighlightRange[]): React.ReactNode[] {
  const lines = splitPreviewTextLines(text);
  const blocks: React.ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const headerRow = parseMarkdownTableRow(lines[index].text, lines[index].start);
    const separatorRow = index + 1 < lines.length
      ? parseMarkdownTableRow(lines[index + 1].text, lines[index + 1].start)
      : null;
    const alignments = separatorRow ? parseMarkdownTableAlignments(separatorRow) : null;

    if (
      headerRow &&
      separatorRow &&
      alignments &&
      headerRow.cells.length === separatorRow.cells.length
    ) {
      const bodyRows: ParsedMarkdownTableRow[] = [];
      let bodyIndex = index + 2;
      while (bodyIndex < lines.length) {
        const nextLine = lines[bodyIndex];
        const nextRow = parseMarkdownTableRow(nextLine.text, nextLine.start);
        if (!nextRow || nextLine.text.trim().length === 0 || nextRow.cells.length !== headerRow.cells.length) {
          break;
        }
        bodyRows.push(nextRow);
        bodyIndex += 1;
      }

      blocks.push(
        <div
          key={`table-${lines[index].start}`}
          className="my-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white/90 shadow-sm dark:border-slate-700 dark:bg-slate-950/70"
        >
          <table className="min-w-max border-collapse text-left text-sm">
            <thead className="bg-slate-100/90 dark:bg-slate-900/90">
              <tr>
                {headerRow.cells.map((cell, cellIndex) => (
                  <th
                    key={`head-${cellIndex}`}
                    className="border border-slate-200 px-3 py-2 font-semibold text-slate-900 dark:border-slate-700 dark:text-slate-100"
                    style={{ textAlign: alignments[cellIndex] }}
                  >
                    {cell.text.length > 0
                      ? renderHighlightedText(cell.text, sliceHighlightRanges(ranges, cell.start, cell.end))
                      : '\u00A0'}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bodyRows.map((row, rowIndex) => (
                <tr key={`row-${rowIndex}`} className="odd:bg-white even:bg-slate-50/70 dark:odd:bg-slate-950/60 dark:even:bg-slate-900/40">
                  {row.cells.map((cell, cellIndex) => (
                    <td
                      key={`cell-${rowIndex}-${cellIndex}`}
                      className="border border-slate-200 px-3 py-2 align-top text-slate-800 dark:border-slate-700 dark:text-slate-200"
                      style={{ textAlign: alignments[cellIndex] }}
                    >
                      {cell.text.length > 0
                        ? renderHighlightedText(cell.text, sliceHighlightRanges(ranges, cell.start, cell.end))
                        : '\u00A0'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );

      index = bodyIndex;
      continue;
    }

    const blockStart = index;
    index += 1;
    while (index < lines.length) {
      const candidateHeader = parseMarkdownTableRow(lines[index].text, lines[index].start);
      const candidateSeparator = index + 1 < lines.length
        ? parseMarkdownTableRow(lines[index + 1].text, lines[index + 1].start)
        : null;
      if (candidateHeader && candidateSeparator && parseMarkdownTableAlignments(candidateSeparator)) {
        break;
      }
      index += 1;
    }

    const blockTextStart = lines[blockStart].start;
    const blockTextEnd = index < lines.length ? lines[index].start : text.length;
    const blockText = text.slice(blockTextStart, blockTextEnd);
    blocks.push(
      <div
        key={`text-${blockTextStart}`}
        className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800 dark:text-slate-100"
      >
        {renderHighlightedText(blockText, sliceHighlightRanges(ranges, blockTextStart, blockTextEnd))}
      </div>,
    );
  }

  return blocks;
}

function findHighlightRangeAtSelection(
  ranges: HighlightRange[],
  start: number,
  end: number,
): HighlightRange | null {
  const selection = normalizeSelectionRange({ start, end });
  if (selection.start === selection.end) {
    return ranges.find(range => selection.start > range.start && selection.start < range.end) ?? null;
  }
  return ranges.find(range => range.start < selection.end && range.end > selection.start) ?? null;
}

function applyHighlightRange(
  ranges: HighlightRange[],
  start: number,
  end: number,
  color: string,
  textLength: number,
): HighlightRange[] {
  const selection = normalizeSelectionRange({ start, end });
  if (selection.start === selection.end) {
    return normalizeHighlightRanges(ranges, textLength);
  }

  const nextRanges: HighlightRange[] = [];
  for (const range of ranges) {
    if (range.end <= selection.start || range.start >= selection.end) {
      nextRanges.push({ ...range });
      continue;
    }
    if (range.start < selection.start) {
      nextRanges.push({
        start: range.start,
        end: selection.start,
        color: range.color,
      });
    }
    if (range.end > selection.end) {
      nextRanges.push({
        start: selection.end,
        end: range.end,
        color: range.color,
      });
    }
  }

  nextRanges.push({
    start: selection.start,
    end: selection.end,
    color: normalizeHighlightColor(color),
  });

  return normalizeHighlightRanges(nextRanges, textLength);
}

function removeHighlightRange(
  ranges: HighlightRange[],
  start: number,
  end: number,
  textLength: number,
): HighlightRange[] {
  const selection = normalizeSelectionRange({ start, end });
  const effectiveSelection = selection.start === selection.end
    ? (() => {
        const target = findHighlightRangeAtSelection(ranges, selection.start, selection.end);
        return target ? { start: target.start, end: target.end } : selection;
      })()
    : selection;

  if (effectiveSelection.start === effectiveSelection.end) {
    return normalizeHighlightRanges(ranges, textLength);
  }

  const nextRanges: HighlightRange[] = [];
  for (const range of ranges) {
    if (range.end <= effectiveSelection.start || range.start >= effectiveSelection.end) {
      nextRanges.push({ ...range });
      continue;
    }
    if (range.start < effectiveSelection.start) {
      nextRanges.push({
        start: range.start,
        end: effectiveSelection.start,
        color: range.color,
      });
    }
    if (range.end > effectiveSelection.end) {
      nextRanges.push({
        start: effectiveSelection.end,
        end: range.end,
        color: range.color,
      });
    }
  }

  return normalizeHighlightRanges(nextRanges, textLength);
}

function updateHighlightRangesForTextChange(
  previousText: string,
  nextText: string,
  ranges: HighlightRange[],
): HighlightRange[] {
  if (previousText === nextText) {
    return normalizeHighlightRanges(ranges, nextText.length);
  }

  let prefixLength = 0;
  const maxPrefixLength = Math.min(previousText.length, nextText.length);
  while (
    prefixLength < maxPrefixLength &&
    previousText[prefixLength] === nextText[prefixLength]
  ) {
    prefixLength += 1;
  }

  let previousSuffix = previousText.length;
  let nextSuffix = nextText.length;
  while (
    previousSuffix > prefixLength &&
    nextSuffix > prefixLength &&
    previousText[previousSuffix - 1] === nextText[nextSuffix - 1]
  ) {
    previousSuffix -= 1;
    nextSuffix -= 1;
  }

  const oldChangeEnd = previousSuffix;
  const newChangeEnd = nextSuffix;
  const delta = nextText.length - previousText.length;
  const nextRanges: HighlightRange[] = [];

  for (const range of ranges) {
    if (range.end <= prefixLength) {
      nextRanges.push({ ...range });
      continue;
    }

    if (range.start >= oldChangeEnd) {
      nextRanges.push({
        start: range.start + delta,
        end: range.end + delta,
        color: range.color,
      });
      continue;
    }

    if (range.start < prefixLength && range.end > oldChangeEnd) {
      nextRanges.push({
        start: range.start,
        end: range.end + delta,
        color: range.color,
      });
      continue;
    }

    if (range.start < prefixLength) {
      nextRanges.push({
        start: range.start,
        end: prefixLength,
        color: range.color,
      });
    }

    if (range.end > oldChangeEnd) {
      nextRanges.push({
        start: newChangeEnd,
        end: range.end + delta,
        color: range.color,
      });
    }
  }

  return normalizeHighlightRanges(nextRanges, nextText.length);
}

// ── Component ──

export function CaseResearchWindow() {
  // ─── State ───
  const [tabs, setTabs] = useState<ResearchTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [pages, setPages] = useState<ResearchPage[]>([]);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [activePage, setActivePage] = useState<ResearchPage | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTabName, setEditingTabName] = useState('');
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [editingPageTitle, setEditingPageTitle] = useState('');
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [copiedId, setCopiedId] = useState(false);
  const [draggedPageId, setDraggedPageId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showRestorePanel, setShowRestorePanel] = useState(false);
  const [isLoadingTrash, setIsLoadingTrash] = useState(false);
  const [trashedTabs, setTrashedTabs] = useState<TrashedResearchTab[]>([]);
  const [trashedPages, setTrashedPages] = useState<TrashedResearchPage[]>([]);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoringKey, setRestoringKey] = useState<string | null>(null);
  const [editorDocument, setEditorDocument] = useState<EditorDocument>({ text: '', highlights: [] });
  const [editorViewMode, setEditorViewMode] = useState<EditorViewMode>('edit');
  const [selectedHighlightColor, setSelectedHighlightColor] = useState<string>(HIGHLIGHT_PRESETS[0].value);
  const [selectionRange, setSelectionRange] = useState<EditorSelectionRange>({ start: 0, end: 0 });
  const [, setHistoryVersion] = useState(0);

  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const editorOverlayRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressEditorHydrationRef = useRef(false);
  const undoStackRef = useRef<EditorSnapshot[]>([]);
  const redoStackRef = useRef<EditorSnapshot[]>([]);
  const editorDocumentRef = useRef<EditorDocument>({ text: '', highlights: [] });
  const selectionRangeRef = useRef<EditorSelectionRange>({ start: 0, end: 0 });

  useEffect(() => {
    editorDocumentRef.current = editorDocument;
  }, [editorDocument]);

  useEffect(() => {
    selectionRangeRef.current = selectionRange;
  }, [selectionRange]);

  // ─── Fetch tabs ───
  const fetchTabs = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/research/tabs`);
      const data: ResearchTab[] = await res.json();
      setTabs(data);
      if (data.length > 0 && !activeTabId) {
        setActiveTabId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch research tabs', err);
    }
  }, [activeTabId]);

  // ─── Fetch pages for active tab ───
  const fetchPages = useCallback(async (tabId: string, preferredPageId?: string | null) => {
    try {
      const res = await fetch(`${API_BASE}/api/research/tabs/${tabId}/pages`);
      const data: ResearchPage[] = await res.json();
      setPages(data);
      if (data.length > 0) {
        const nextPage = data.find(page => page.id === preferredPageId) ?? data[0];
        setActivePageId(nextPage.id);
        setActivePage(nextPage);
      } else {
        setActivePageId(null);
        setActivePage(null);
      }
    } catch (err) {
      console.error('Failed to fetch pages', err);
    }
  }, []);

  // ─── Search ───
  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    try {
      const res = await fetch(`${API_BASE}/api/research/search?q=${encodeURIComponent(q)}`);
      const data: SearchResult[] = await res.json();
      setSearchResults(data);
    } catch (err) {
      console.error('Search failed', err);
    }
  }, []);

  // ─── Effects ───
  useEffect(() => { fetchTabs(); }, [fetchTabs]);

  useEffect(() => {
    if (activeTabId) fetchPages(activeTabId, activePageId);
  }, [activeTabId, fetchPages]);

  const fetchPageDetail = useCallback(async (pageId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/research/pages/${pageId}`);
      const data: ResearchPage = await res.json();
      setActivePageId(data.id);
      setActivePage(data);
      setPages(prev => prev.map(page => page.id === data.id ? data : page));
    } catch (err) {
      console.error('Failed to fetch research page detail', err);
    }
  }, []);

  const fetchTrash = useCallback(async () => {
    setIsLoadingTrash(true);
    setRestoreError(null);
    try {
      const res = await fetch(`${API_BASE}/api/research/trash`);
      if (!res.ok) {
        throw new Error(`Trash fetch failed with status ${res.status}`);
      }
      const data: ResearchTrashResponse = await res.json();
      setTrashedTabs(data.tabs);
      setTrashedPages(data.pages);
    } catch (err) {
      console.error('Failed to fetch research trash', err);
      setRestoreError('Failed to load deleted items.');
    } finally {
      setIsLoadingTrash(false);
    }
  }, []);

  // Search debounce
  useEffect(() => {
    const timer = setTimeout(() => doSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery, doSearch]);

  useEffect(() => {
    if (!contextMenu) return;
    const handleClose = () => setContextMenu(null);
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setContextMenu(null);
      }
    };
    window.addEventListener('click', handleClose);
    window.addEventListener('contextmenu', handleClose);
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('click', handleClose);
      window.removeEventListener('contextmenu', handleClose);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [contextMenu]);

  useEffect(() => {
    if (suppressEditorHydrationRef.current) {
      suppressEditorHydrationRef.current = false;
      return;
    }

    const parsedDocument = parseEditorDocument(activePage?.body ?? '');
    editorDocumentRef.current = parsedDocument;
    setEditorDocument(parsedDocument);
    undoStackRef.current = [];
    redoStackRef.current = [];
    setHistoryVersion(version => version + 1);
    const initialSelection = { start: 0, end: 0 };
    selectionRangeRef.current = initialSelection;
    setSelectionRange(initialSelection);

    requestAnimationFrame(() => {
      if (bodyRef.current) {
        bodyRef.current.scrollTop = 0;
        bodyRef.current.scrollLeft = 0;
      }
      if (editorOverlayRef.current) {
        editorOverlayRef.current.scrollTop = 0;
        editorOverlayRef.current.scrollLeft = 0;
      }
    });
  }, [activePage?.id, activePage?.body]);

  // ─── Auto-save with debounce ───
  const scheduleSave = useCallback((pageId: string, title: string, body: string) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/research/pages/${pageId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, body }),
        });
        if (!res.ok) {
          throw new Error(`Auto-save failed with status ${res.status}`);
        }
        const updated: ResearchPage = await res.json();
        setActivePage(updated);
        // Update page title in sidebar list
        setPages(prev => prev.map(p => p.id === pageId ? { ...p, title: updated.title, updated_at: updated.updated_at } : p));
      } catch (err) {
        console.error('Auto-save failed', err);
      }
    }, 500);
  }, []);

  const syncEditorScroll = useCallback(() => {
    if (!bodyRef.current || !editorOverlayRef.current) {
      return;
    }
    editorOverlayRef.current.scrollTop = bodyRef.current.scrollTop;
    editorOverlayRef.current.scrollLeft = bodyRef.current.scrollLeft;
  }, []);

  const syncSelectionRange = useCallback(() => {
    const textarea = bodyRef.current;
    if (!textarea) {
      return;
    }
    setSelectionRange({
      start: textarea.selectionStart ?? 0,
      end: textarea.selectionEnd ?? 0,
    });
  }, []);

  const commitEditorDocument = useCallback((
    nextDocument: EditorDocument,
    nextSelection: EditorSelectionRange,
    options?: { pushHistory?: boolean; restoreSelection?: boolean },
  ) => {
    if (!activePage) {
      return;
    }

    const normalizedDocument: EditorDocument = {
      text: nextDocument.text,
      highlights: normalizeHighlightRanges(nextDocument.highlights, nextDocument.text.length),
    };
    const normalizedSelection = normalizeSelectionRange(nextSelection);

    if (options?.pushHistory !== false) {
      const currentSnapshot: EditorSnapshot = {
        document: cloneEditorDocument(editorDocumentRef.current),
        selection: { ...normalizeSelectionRange(selectionRangeRef.current) },
      };
      const nextSnapshot: EditorSnapshot = {
        document: cloneEditorDocument(normalizedDocument),
        selection: { ...normalizedSelection },
      };
      if (
        !areEditorDocumentsEqual(currentSnapshot.document, nextSnapshot.document) ||
        currentSnapshot.selection.start !== nextSnapshot.selection.start ||
        currentSnapshot.selection.end !== nextSnapshot.selection.end
      ) {
        undoStackRef.current.push(currentSnapshot);
        redoStackRef.current = [];
        setHistoryVersion(version => version + 1);
      }
    }

    editorDocumentRef.current = normalizedDocument;
    setEditorDocument(normalizedDocument);
    selectionRangeRef.current = normalizedSelection;
    setSelectionRange(normalizedSelection);

    const serializedBody = serializeEditorDocument(normalizedDocument);
    suppressEditorHydrationRef.current = true;
    setActivePage(prev => prev && prev.id === activePage.id ? { ...prev, body: serializedBody } : prev);
    scheduleSave(activePage.id, activePage.title, serializedBody);

    if (options?.restoreSelection) {
      requestAnimationFrame(() => {
        const textarea = bodyRef.current;
        if (!textarea) {
          return;
        }
        textarea.focus();
        textarea.setSelectionRange(normalizedSelection.start, normalizedSelection.end);
        syncEditorScroll();
      });
    }
  }, [activePage, scheduleSave, syncEditorScroll]);

  const handleUndo = useCallback(() => {
    if (!activePage) {
      return;
    }
    const previousSnapshot = undoStackRef.current.pop();
    if (!previousSnapshot) {
      return;
    }
    redoStackRef.current.push({
      document: cloneEditorDocument(editorDocumentRef.current),
      selection: { ...selectionRangeRef.current },
    });
    setHistoryVersion(version => version + 1);
    commitEditorDocument(previousSnapshot.document, previousSnapshot.selection, {
      pushHistory: false,
      restoreSelection: true,
    });
  }, [activePage, commitEditorDocument]);

  const handleRedo = useCallback(() => {
    if (!activePage) {
      return;
    }
    const nextSnapshot = redoStackRef.current.pop();
    if (!nextSnapshot) {
      return;
    }
    undoStackRef.current.push({
      document: cloneEditorDocument(editorDocumentRef.current),
      selection: { ...selectionRangeRef.current },
    });
    setHistoryVersion(version => version + 1);
    commitEditorDocument(nextSnapshot.document, nextSnapshot.selection, {
      pushHistory: false,
      restoreSelection: true,
    });
  }, [activePage, commitEditorDocument]);

  const handleFormatTable = useCallback(() => {
    const textarea = bodyRef.current;
    if (!textarea || !activePage) {
      return;
    }

    const start = textarea.selectionStart ?? selectionRangeRef.current.start;
    const end = textarea.selectionEnd ?? selectionRangeRef.current.end;
    const formatted = formatMarkdownTablesInSelection(editorDocumentRef.current.text, start, end);
    if (!formatted || formatted.text === editorDocumentRef.current.text) {
      return;
    }

    const nextDocument: EditorDocument = {
      text: formatted.text,
      highlights: updateHighlightRangesForTextChange(
        editorDocumentRef.current.text,
        formatted.text,
        editorDocumentRef.current.highlights,
      ),
    };
    commitEditorDocument(nextDocument, formatted.selection, { restoreSelection: true });
  }, [activePage, commitEditorDocument]);

  const handleEditorKeyDown = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const key = event.key.toLowerCase();
    const isModifierPressed = event.ctrlKey || event.metaKey;
    const isUndo = isModifierPressed && !event.shiftKey && key === 'z';
    const isRedo = isModifierPressed && (key === 'y' || (event.shiftKey && key === 'z'));

    if (isUndo) {
      event.preventDefault();
      handleUndo();
      return;
    }

    if (isRedo) {
      event.preventDefault();
      handleRedo();
    }
  }, [handleRedo, handleUndo]);

  const applyHighlightToSelection = useCallback(() => {
    const textarea = bodyRef.current;
    if (!textarea || !activePage) {
      return;
    }

    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;
    if (start === end) {
      return;
    }

    const nextHighlights = applyHighlightRange(
      editorDocumentRef.current.highlights,
      start,
      end,
      selectedHighlightColor,
      editorDocumentRef.current.text.length,
    );
    commitEditorDocument(
      { text: editorDocumentRef.current.text, highlights: nextHighlights },
      { start, end },
      { restoreSelection: true },
    );
  }, [activePage, commitEditorDocument, selectedHighlightColor]);

  const removeHighlightFromSelection = useCallback(() => {
    const textarea = bodyRef.current;
    if (!textarea || !activePage) {
      return;
    }

    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;
    const targetHighlight = findHighlightRangeAtSelection(editorDocumentRef.current.highlights, start, end);
    if (!targetHighlight) {
      return;
    }

    const normalizedSelection = normalizeSelectionRange({ start, end });
    const effectiveSelection = normalizedSelection.start === normalizedSelection.end
      ? { start: targetHighlight.start, end: targetHighlight.end }
      : normalizedSelection;
    const nextHighlights = removeHighlightRange(
      editorDocumentRef.current.highlights,
      effectiveSelection.start,
      effectiveSelection.end,
      editorDocumentRef.current.text.length,
    );

    commitEditorDocument(
      { text: editorDocumentRef.current.text, highlights: nextHighlights },
      { start: effectiveSelection.start, end: effectiveSelection.start },
      { restoreSelection: true },
    );
  }, [activePage, commitEditorDocument]);

  // ─── Handlers ───
  const handleCreateTab = async () => {
    try {
      setContextMenu(null);
      const res = await fetch(`${API_BASE}/api/research/tabs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New Section' }),
      });
      const tab: ResearchTab = await res.json();
      setTabs(prev => [...prev, tab]);
      setActiveTabId(tab.id);
    } catch (err) {
      console.error('Tab creation failed', err);
    }
  };

  const handleRenameTab = async (id: string) => {
    if (!editingTabName.trim()) { setEditingTabId(null); return; }
    try {
      await fetch(`${API_BASE}/api/research/tabs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingTabName }),
      });
      setTabs(prev => prev.map(t => t.id === id ? { ...t, name: editingTabName } : t));
    } catch (err) {
      console.error('Tab rename failed', err);
    }
    setEditingTabId(null);
    setContextMenu(null);
  };

  const handleDeleteTab = async (id: string) => {
    try {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      await fetch(`${API_BASE}/api/research/tabs/${id}`, { method: 'DELETE' });
      const remainingTabs = tabs.filter(t => t.id !== id);
      setTabs(remainingTabs);
      if (activeTabId === id) {
        const nextTabId = remainingTabs[0]?.id ?? null;
        setActiveTabId(nextTabId);
        if (!nextTabId) {
          setPages([]);
          setActivePageId(null);
          setActivePage(null);
        }
      }
    } catch (err) {
      console.error('Tab deletion failed', err);
    }
    setContextMenu(null);
  };

  const handleCreatePage = async () => {
    if (!activeTabId) return;
    try {
      setContextMenu(null);
      const res = await fetch(`${API_BASE}/api/research/tabs/${activeTabId}/pages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const page: ResearchPage = await res.json();
      setPages(prev => [...prev, page]);
      setActivePageId(page.id);
      setActivePage(page);
      setTimeout(() => titleRef.current?.focus(), 50);
    } catch (err) {
      console.error('Page creation failed', err);
    }
  };

  const handleRenamePage = async (id: string) => {
    const nextTitle = editingPageTitle.trim();
    if (!nextTitle) {
      setEditingPageId(null);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/research/pages/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: nextTitle }),
      });
      if (!res.ok) {
        throw new Error(`Page rename failed with status ${res.status}`);
      }
      const updated: ResearchPage = await res.json();
      setPages(prev => prev.map(p => p.id === id ? updated : p));
      if (activePageId === id) {
        setActivePage(prev => prev ? { ...prev, title: updated.title, updated_at: updated.updated_at } : prev);
      }
    } catch (err) {
      console.error('Page rename failed', err);
    }
    setEditingPageId(null);
    setContextMenu(null);
  };

  const handleDeletePage = async (id: string) => {
    try {
      if (activePageId === id && saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      await fetch(`${API_BASE}/api/research/pages/${id}`, { method: 'DELETE' });
      const remainingPages = pages.filter(p => p.id !== id);
      setPages(remainingPages);
      if (activePageId === id) {
        setActivePageId(remainingPages[0]?.id ?? null);
        setActivePage(remainingPages[0] ?? null);
      }
    } catch (err) {
      console.error('Page deletion failed', err);
    }
    setContextMenu(null);
  };

  const handleTitleChange = (value: string) => {
    if (!activePage) return;
    setActivePage(prev => prev ? { ...prev, title: value } : null);
    setPages(prev => prev.map(p => p.id === activePage.id ? { ...p, title: value } : p));
    scheduleSave(activePage.id, value, serializeEditorDocument(editorDocumentRef.current));
  };

  const handleBodyChange = (value: string, nextStart: number, nextEnd: number) => {
    if (!activePage) return;
    const nextDocument: EditorDocument = {
      text: value,
      highlights: updateHighlightRangesForTextChange(
        editorDocumentRef.current.text,
        value,
        editorDocumentRef.current.highlights,
      ),
    };
    commitEditorDocument(nextDocument, { start: nextStart, end: nextEnd });
  };

  const handleCopyId = () => {
    if (!activePage) return;
    navigator.clipboard.writeText(activePage.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 1500);
  };

  const handleSearchResultClick = (result: SearchResult) => {
    setActiveTabId(result.tab_id);
    setActivePageId(result.id);
    setActivePage(result);
    setSearchQuery('');
    setIsSearching(false);
    setSearchResults([]);
  };

  const handleSelectPage = (page: ResearchPage) => {
    setActivePageId(page.id);
    setActivePage(page);
    setEditingPageId(null);
  };

  const openContextMenu = (event: React.MouseEvent, type: 'tab' | 'page', id: string) => {
    event.preventDefault();
    event.stopPropagation();
    if (type === 'page') {
      const targetPage = pages.find(page => page.id === id);
      if (targetPage) {
        setActivePageId(targetPage.id);
        setActivePage(targetPage);
      }
    }
    setContextMenu({ type, id, x: event.clientX, y: event.clientY });
  };

  const handleContextRename = () => {
    if (!contextMenu) return;
    if (contextMenu.type === 'tab') {
      const targetTab = tabs.find(tab => tab.id === contextMenu.id);
      if (!targetTab) return;
      setEditingTabId(targetTab.id);
      setEditingTabName(targetTab.name);
      setContextMenu(null);
      return;
    }
    const targetPage = pages.find(page => page.id === contextMenu.id);
    if (!targetPage) return;
    setEditingPageId(targetPage.id);
    setEditingPageTitle(targetPage.title || '');
    setContextMenu(null);
  };

  const handleContextDelete = () => {
    if (!contextMenu) return;
    if (contextMenu.type === 'tab') {
      void handleDeleteTab(contextMenu.id);
      return;
    }
    void handleDeletePage(contextMenu.id);
  };

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const tabsRes = await fetch(`${API_BASE}/api/research/tabs`);
      const nextTabs: ResearchTab[] = await tabsRes.json();
      setTabs(nextTabs);

      const nextTabId = nextTabs.find(tab => tab.id === activeTabId)?.id ?? nextTabs[0]?.id ?? null;
      setActiveTabId(nextTabId);

      if (!nextTabId) {
        setPages([]);
        setActivePageId(null);
        setActivePage(null);
        return;
      }

      const pagesRes = await fetch(`${API_BASE}/api/research/tabs/${nextTabId}/pages`);
      const nextPages: ResearchPage[] = await pagesRes.json();
      setPages(nextPages);

      const nextPageId = nextPages.find(page => page.id === activePageId)?.id ?? nextPages[0]?.id ?? null;
      setActivePageId(nextPageId);

      if (!nextPageId) {
        setActivePage(null);
        return;
      }

      const pageRes = await fetch(`${API_BASE}/api/research/pages/${nextPageId}`);
      const nextPage: ResearchPage = await pageRes.json();
      setActivePage(nextPage);
      setPages(prev => prev.map(page => page.id === nextPage.id ? nextPage : page));
    } catch (err) {
      console.error('Manual refresh failed', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [activePageId, activeTabId]);

  const handleOpenRestorePanel = useCallback(async () => {
    setShowRestorePanel(true);
    await fetchTrash();
  }, [fetchTrash]);

  const handleRestoreTab = async (tabId: string) => {
    setRestoringKey(`tab:${tabId}`);
    setRestoreError(null);
    try {
      const res = await fetch(`${API_BASE}/api/research/tabs/${tabId}/restore`, { method: 'POST' });
      if (!res.ok) {
        throw new Error(`Restore tab failed with status ${res.status}`);
      }
      const restoredTab: ResearchTab = await res.json();
      setShowRestorePanel(false);
      await fetchTabs();
      setActiveTabId(restoredTab.id);
      await fetchPages(restoredTab.id);
    } catch (err) {
      console.error('Tab restore failed', err);
      setRestoreError('Failed to restore the deleted section.');
      await fetchTrash();
    } finally {
      setRestoringKey(null);
    }
  };

  const handleRestorePage = async (pageId: string) => {
    setRestoringKey(`page:${pageId}`);
    setRestoreError(null);
    try {
      const res = await fetch(`${API_BASE}/api/research/pages/${pageId}/restore`, { method: 'POST' });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error ?? `Restore page failed with status ${res.status}`);
      }
      const restoredPage: ResearchPage = await res.json();
      setShowRestorePanel(false);
      setActiveTabId(restoredPage.tab_id);
      await fetchTabs();
      await fetchPages(restoredPage.tab_id, restoredPage.id);
      await fetchPageDetail(restoredPage.id);
    } catch (err) {
      console.error('Page restore failed', err);
      setRestoreError(err instanceof Error ? err.message : 'Failed to restore the deleted page.');
      await fetchTrash();
    } finally {
      setRestoringKey(null);
    }
  };

  const persistPageOrder = useCallback(async (tabId: string, nextPages: ResearchPage[]) => {
    try {
      const res = await fetch(`${API_BASE}/api/research/tabs/${tabId}/pages/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageIds: nextPages.map(page => page.id) }),
      });
      const savedPages: ResearchPage[] = await res.json();
      setPages(savedPages);
    } catch (err) {
      console.error('Page reorder failed', err);
      fetchPages(tabId);
    }
  }, [fetchPages]);

  const handlePageDrop = useCallback((targetPageId: string) => {
    if (!activeTabId || !draggedPageId || draggedPageId === targetPageId) {
      setDraggedPageId(null);
      return;
    }

    const currentPages = [...pages];
    const draggedIndex = currentPages.findIndex(page => page.id === draggedPageId);
    const targetIndex = currentPages.findIndex(page => page.id === targetPageId);
    if (draggedIndex < 0 || targetIndex < 0) {
      setDraggedPageId(null);
      return;
    }

    const [draggedPage] = currentPages.splice(draggedIndex, 1);
    currentPages.splice(targetIndex, 0, draggedPage);
    const reorderedPages = currentPages.map((page, index) => ({ ...page, sort_order: index }));
    setPages(reorderedPages);
    setDraggedPageId(null);
    void persistPageOrder(activeTabId, reorderedPages);
  }, [activeTabId, draggedPageId, pages, persistPageOrder]);

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso + (iso.endsWith('Z') ? '' : 'Z'));
      return d.toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch {
      return iso;
    }
  };

  const hasSelectedText = selectionRange.start !== selectionRange.end;
  const canUndo = undoStackRef.current.length > 0;
  const canRedo = redoStackRef.current.length > 0;
  const canRemoveHighlight = Boolean(findHighlightRangeAtSelection(
    editorDocument.highlights,
    selectionRange.start,
    selectionRange.end,
  ));

  // ─── Render ───
  return (
    <div className="relative flex flex-col h-full bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100" style={{ minHeight: 0 }}>
      {/* ── Top: Search Bar ── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-200 bg-slate-50 shrink-0 dark:border-slate-800 dark:bg-slate-900">
        <Search size={14} className="text-slate-400 dark:text-slate-500" />
        <input
          type="text"
          placeholder="Search all tabs & pages..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
        <button
          onClick={() => { void handleRefresh(); }}
          disabled={isRefreshing}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:border-blue-400 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-blue-500 dark:hover:text-blue-400"
          title="Refresh tabs, pages, and the current note"
        >
          <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
        <button
          onClick={() => { void handleOpenRestorePanel(); }}
          disabled={isLoadingTrash}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:border-emerald-400 hover:text-emerald-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-emerald-500 dark:hover:text-emerald-400"
          title="Show deleted tabs and pages that can be restored"
        >
          <RotateCcw size={12} className={isLoadingTrash ? 'animate-spin' : ''} />
          Restore
        </button>
        {searchQuery && (
          <button onClick={() => { setSearchQuery(''); setIsSearching(false); setSearchResults([]); }} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
            <span className="text-xs">✕</span>
          </button>
        )}
      </div>

      {/* ── Top: Section Bar ── */}
      <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-200 bg-white px-3 py-2 shrink-0 dark:border-slate-800 dark:bg-slate-950">
        {tabs.map(tab => (
          <div key={tab.id} className="group relative shrink-0">
            {editingTabId === tab.id ? (
              <input
                autoFocus
                value={editingTabName}
                onChange={e => setEditingTabName(e.target.value)}
                onBlur={() => handleRenameTab(tab.id)}
                onKeyDown={e => { if (e.key === 'Enter') handleRenameTab(tab.id); if (e.key === 'Escape') setEditingTabId(null); }}
                className="w-44 rounded-t-xl border border-b-0 border-slate-300 bg-white px-4 py-2 text-sm outline-none dark:border-slate-700 dark:bg-slate-900"
              />
            ) : (
              <button
                onClick={() => setActiveTabId(tab.id)}
                onDoubleClick={() => { setEditingTabId(tab.id); setEditingTabName(tab.name); }}
                onContextMenu={event => openContextMenu(event, 'tab', tab.id)}
                className={`min-w-44 rounded-t-xl border border-b-0 px-4 py-2.5 text-sm text-left transition-colors ${
                  activeTabId === tab.id
                    ? 'border-slate-300 bg-white text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'
                    : 'border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:bg-slate-900'
                }`}
              >
                <div className="truncate font-medium">{tab.name}</div>
              </button>
            )}
            <button
              onClick={() => handleDeleteTab(tab.id)}
              className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100 text-slate-400 hover:text-red-500 dark:text-slate-500"
              title="Soft delete section (permanent after 24 hours)"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
        <button
          onClick={handleCreateTab}
          className="shrink-0 rounded-full border border-dashed border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:border-blue-400 hover:text-blue-600 dark:border-slate-700 dark:text-slate-300 dark:hover:border-blue-500 dark:hover:text-blue-400"
          title="New section"
        >
          <span className="inline-flex items-center gap-1"><Plus size={12} /> New Section</span>
        </button>
      </div>

      {/* ── Search Results Overlay ── */}
      {isSearching && searchResults.length > 0 && (
        <div className="absolute left-2 right-2 top-10 z-50 max-h-60 overflow-y-auto rounded-b-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
          {searchResults.map(r => (
            <button
              key={r.id}
              onClick={() => handleSearchResultClick(r)}
              className="w-full border-b border-slate-100 px-3 py-2 text-left hover:bg-slate-50 last:border-b-0 dark:border-slate-800 dark:hover:bg-slate-800"
            >
              <div className="truncate text-xs font-medium text-blue-600 dark:text-blue-400">{r.title || '(Untitled)'}</div>
              <div className="truncate text-[10px] text-slate-500 dark:text-slate-400">
                <span className="text-amber-600 dark:text-amber-400">[{r.tab_name}]</span> {stripHighlightMarkup(r.body).slice(0, 80)}…
              </div>
            </button>
          ))}
        </div>
      )}
      {isSearching && searchResults.length === 0 && searchQuery.trim() && (
        <div className="absolute left-2 right-2 top-10 z-50 rounded-b-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
          No results found.
        </div>
      )}

      {/* ── Main: Sidebar + Content ── */}
      <div className="flex flex-1 min-h-0 relative">
        {/* ── Left Sidebar ── */}
        <div className="w-64 shrink-0 border-r border-slate-200 bg-slate-50 flex flex-col min-h-0 dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 px-3 py-2 shrink-0 dark:border-slate-800">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Section</div>
            <div className="mt-1 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{tabs.find(tab => tab.id === activeTabId)?.name ?? 'No Section'}</div>
          </div>

          {/* Page list */}
          <div className="flex-1 overflow-y-auto">
            {pages.map(page => (
              <button
                key={page.id}
                draggable
                onDragStart={() => setDraggedPageId(page.id)}
                onDragEnd={() => setDraggedPageId(null)}
                onDragOver={e => e.preventDefault()}
                onDrop={() => handlePageDrop(page.id)}
                onClick={() => handleSelectPage(page)}
                onContextMenu={event => openContextMenu(event, 'page', page.id)}
                className={`w-full text-left px-3 py-3 border-b border-slate-200/80 group cursor-grab active:cursor-grabbing dark:border-slate-800/80 ${draggedPageId === page.id ? 'opacity-50' : ''} ${activePageId === page.id ? 'bg-white dark:bg-slate-800' : 'hover:bg-slate-100 dark:hover:bg-slate-800/70'}`}
              >
                <div className="flex items-center justify-between">
                  {editingPageId === page.id ? (
                    <input
                      autoFocus
                      value={editingPageTitle}
                      onChange={e => setEditingPageTitle(e.target.value)}
                      onBlur={() => { void handleRenamePage(page.id); }}
                      onClick={event => event.stopPropagation()}
                      onKeyDown={event => {
                        if (event.key === 'Enter') {
                          void handleRenamePage(page.id);
                        }
                        if (event.key === 'Escape') {
                          setEditingPageId(null);
                        }
                      }}
                      className="mr-2 flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                  ) : (
                    <span className="text-xs truncate flex-1 text-slate-800 dark:text-slate-100">{page.title || '(Untitled)'}</span>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); handleDeletePage(page.id); }}
                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-opacity ml-1"
                    title="Soft delete page (permanent after 24 hours)"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
                <div className="text-[10px] text-slate-500 truncate mt-0.5 dark:text-slate-400">{formatDate(page.updated_at)}</div>
              </button>
            ))}
          </div>

          {/* New page button */}
          <div className="px-3 py-2 border-t border-slate-200 shrink-0 dark:border-slate-800">
            <button
              onClick={handleCreatePage}
              disabled={!activeTabId}
              className="flex w-full items-center gap-1 rounded-lg border border-dashed border-slate-300 px-2 py-2 text-xs font-medium text-blue-600 hover:border-blue-400 hover:bg-blue-50 disabled:text-slate-400 disabled:cursor-not-allowed dark:border-slate-700 dark:text-blue-400 dark:hover:border-blue-500 dark:hover:bg-slate-800"
            >
              <Plus size={12} /> New Page
            </button>
          </div>
        </div>

        {/* ── Right: Page Content ── */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0 bg-white dark:bg-slate-950">
          {activePage ? (
            <>
              {/* Page ID + metadata */}
              <div className="px-6 pt-5 pb-3 border-b border-slate-200 shrink-0 bg-white/90 dark:border-slate-800 dark:bg-slate-900/60">
                {/* Page ID row */}
                <div className="flex items-center gap-2 mb-2">
                  <FileText size={12} className="text-slate-500 shrink-0 dark:text-slate-400" />
                  <code className="text-[10px] text-slate-500 font-mono select-all dark:text-slate-400">{activePage.id}</code>
                  <button
                    onClick={handleCopyId}
                    className="text-slate-500 hover:text-blue-600 shrink-0 dark:hover:text-blue-400"
                    title="Copy page ID"
                  >
                    {copiedId ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                  </button>
                </div>

                {/* Title */}
                <input
                  ref={titleRef}
                  value={activePage.title}
                  onChange={e => handleTitleChange(e.target.value)}
                  placeholder="Page title..."
                  className="w-full bg-transparent text-2xl font-semibold text-slate-900 outline-none placeholder-slate-400 dark:text-slate-100 dark:placeholder-slate-600"
                />

                {/* Dates */}
                <div className="flex gap-4 mt-2 text-[10px] text-slate-500 dark:text-slate-400">
                  <span>Created: {formatDate(activePage.created_at)}</span>
                  <span>Modified: {formatDate(activePage.updated_at)}</span>
                  <button
                    onClick={() => { void handleRefresh(); }}
                    disabled={isRefreshing}
                    className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-60 dark:text-slate-400 dark:hover:text-blue-400"
                    title="Refresh current note from DB"
                  >
                    <RefreshCw size={10} className={isRefreshing ? 'animate-spin' : ''} />
                    Refresh
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/70 px-6 py-3 dark:border-slate-800 dark:bg-slate-900/40">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Text Highlight</div>
                  {HIGHLIGHT_PRESETS.map(option => {
                    const isActive = selectedHighlightColor === option.value;
                    return (
                      <button
                        key={option.value}
                        onClick={() => setSelectedHighlightColor(option.value)}
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium transition-colors ${isActive ? 'border-slate-900 text-slate-900 dark:border-slate-100 dark:text-slate-100' : 'border-slate-300 text-slate-600 hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:text-slate-100'}`}
                        title={`Use ${option.label} highlight`}
                      >
                        <span className="h-3 w-3 rounded-full border border-slate-300 dark:border-slate-600" style={{ backgroundColor: option.value }} />
                        {option.label}
                      </button>
                    );
                  })}
                  <label className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                    <span>Custom</span>
                    <input
                      type="color"
                      value={selectedHighlightColor}
                      onChange={event => setSelectedHighlightColor(normalizeHighlightColor(event.target.value))}
                      className="h-5 w-6 cursor-pointer border-0 bg-transparent p-0"
                      title="Pick custom highlight color"
                    />
                  </label>
                  <button
                    onClick={applyHighlightToSelection}
                    disabled={!hasSelectedText}
                    className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-[11px] font-semibold text-amber-800 transition-colors hover:border-amber-400 hover:bg-amber-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:border-amber-700 dark:hover:bg-amber-950/50 dark:disabled:border-slate-800 dark:disabled:bg-slate-900 dark:disabled:text-slate-500"
                    title="Wrap the selected text with highlight markup"
                  >
                    Apply to selection
                  </button>
                  <button
                    onClick={removeHighlightFromSelection}
                    disabled={!canRemoveHighlight}
                    className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-900 dark:disabled:border-slate-800 dark:disabled:bg-slate-900 dark:disabled:text-slate-500"
                    title="Remove highlight from the current selection or the current highlighted block"
                  >
                    Remove highlight
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleUndo}
                    disabled={!canUndo}
                    className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-900 dark:disabled:border-slate-800 dark:disabled:bg-slate-900 dark:disabled:text-slate-500"
                    title="Undo the last text or highlight change (Ctrl+Z)"
                  >
                    Undo
                  </button>
                  <button
                    onClick={handleRedo}
                    disabled={!canRedo}
                    className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-900 dark:disabled:border-slate-800 dark:disabled:bg-slate-900 dark:disabled:text-slate-500"
                    title="Redo the last undone change (Ctrl+Y)"
                  >
                    Redo
                  </button>
                  <button
                    onClick={handleFormatTable}
                    className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-900"
                    title="Align the selected markdown table, or the table under the cursor"
                  >
                    Format table
                  </button>
                  {(['edit', 'split', 'preview'] as EditorViewMode[]).map(mode => {
                    const isActive = editorViewMode === mode;
                    return (
                      <button
                        key={mode}
                        onClick={() => setEditorViewMode(mode)}
                        className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold capitalize transition-colors ${isActive ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-950/40 dark:text-blue-300' : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:text-slate-100'}`}
                      >
                        {mode}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className={`flex-1 min-h-0 ${editorViewMode === 'split' ? 'flex flex-col xl:flex-row' : 'flex'}`}>
                {(editorViewMode === 'edit' || editorViewMode === 'split') && (
                  <div className={`flex min-h-0 flex-col ${editorViewMode === 'split' ? 'flex-1 border-b border-slate-200 xl:border-b-0 xl:border-r dark:border-slate-800' : 'w-full'}`}>
                    <div className="border-b border-slate-200 bg-white px-6 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-500">
                      Editor
                    </div>
                    <div className="relative flex-1 min-h-0 overflow-hidden">
                      <div
                        ref={editorOverlayRef}
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 overflow-auto px-6 py-5 font-mono text-sm leading-relaxed whitespace-pre-wrap break-words text-slate-800 [tab-size:2] dark:text-slate-100"
                        style={{ fontFamily: EDITOR_MONO_FONT_FAMILY }}
                      >
                        {editorDocument.text.length > 0 ? renderHighlightedText(editorDocument.text, editorDocument.highlights) : (
                          <span className="text-slate-400 dark:text-slate-600">Write your notes here...</span>
                        )}
                        {'\n'}
                      </div>
                      <textarea
                        ref={bodyRef}
                        wrap="off"
                        value={editorDocument.text}
                        onChange={e => handleBodyChange(e.target.value, e.target.selectionStart ?? 0, e.target.selectionEnd ?? 0)}
                        onSelect={syncSelectionRange}
                        onKeyUp={syncSelectionRange}
                        onMouseUp={syncSelectionRange}
                        onKeyDown={handleEditorKeyDown}
                        onScroll={syncEditorScroll}
                        placeholder="Write your notes here..."
                        className="absolute inset-0 h-full w-full resize-none overflow-auto bg-transparent px-6 py-5 font-mono text-sm leading-relaxed outline-none placeholder:text-transparent selection:bg-blue-200/70 [tab-size:2] caret-slate-900 dark:selection:bg-blue-500/30 dark:caret-slate-100"
                        style={{
                          minHeight: '100%',
                          color: 'transparent',
                          WebkitTextFillColor: 'transparent',
                          fontFamily: EDITOR_MONO_FONT_FAMILY,
                        }}
                      />
                    </div>
                  </div>
                )}

                {(editorViewMode === 'preview' || editorViewMode === 'split') && (
                  <div className={`flex min-h-0 flex-col ${editorViewMode === 'split' ? 'flex-1 bg-slate-50/70 dark:bg-slate-900/30' : 'w-full bg-slate-50/70 dark:bg-slate-900/30'}`}>
                    <div className="border-b border-slate-200 bg-slate-50/90 px-6 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-500">
                      Preview
                    </div>
                    <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
                      {editorDocument.text.trim() ? (
                        <div className="space-y-3 text-sm leading-relaxed text-slate-800 dark:text-slate-100">
                          {renderPreviewContent(editorDocument.text, editorDocument.highlights)}
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-white/80 px-4 py-5 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-400">
                          Highlight preview appears here. Select text in the editor, choose a color, then apply it.
                        </div>
                      )}
                      <div className="mt-4 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-[11px] text-slate-500 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-400">
                        Stored format: <span className="font-mono text-slate-700 dark:text-slate-200">{`[[hl=${selectedHighlightColor}]]text[[/hl]]`}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-500 dark:text-slate-500">
              <div className="text-center">
                <FolderOpen size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">{activeTabId ? 'No pages yet. Create one!' : 'Select or create a tab to start.'}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {contextMenu && (
        <div
          className="fixed z-[70] min-w-40 rounded-lg border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-900"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={event => event.stopPropagation()}
        >
          <button
            onClick={handleContextRename}
            className="block w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Rename
          </button>
          <button
            onClick={handleContextDelete}
            className="block w-full px-3 py-2 text-left text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
          >
            Delete (24h hold)
          </button>
        </div>
      )}

      {showRestorePanel && (
        <div className="absolute inset-0 z-[65] flex items-start justify-end bg-slate-950/20 backdrop-blur-[1px] dark:bg-black/40">
          <div className="mt-12 mr-4 flex max-h-[75vh] w-[28rem] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Restore Deleted Items</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Soft-deleted items stay recoverable for up to 24 hours.</div>
              </div>
              <button
                onClick={() => setShowRestorePanel(false)}
                className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                title="Close restore panel"
              >
                <X size={14} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3">
              {restoreError && (
                <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                  {restoreError}
                </div>
              )}

              <div className="mb-4">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Deleted Sections</div>
                {trashedTabs.length === 0 ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">No deleted sections waiting for restore.</div>
                ) : (
                  <div className="space-y-2">
                    {trashedTabs.map(tab => (
                      <div key={tab.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-800/60">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{tab.name}</div>
                            <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Deleted: {formatDate(tab.deleted_at)}</div>
                          </div>
                          <button
                            onClick={() => { void handleRestoreTab(tab.id); }}
                            disabled={restoringKey === `tab:${tab.id}`}
                            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:border-emerald-400 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/50"
                          >
                            <RotateCcw size={11} className={restoringKey === `tab:${tab.id}` ? 'animate-spin' : ''} />
                            Restore
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Deleted Pages</div>
                {trashedPages.length === 0 ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">No deleted pages waiting for restore.</div>
                ) : (
                  <div className="space-y-2">
                    {trashedPages.map(page => {
                      const isBlocked = Boolean(page.tab_deleted_at);
                      return (
                        <div key={page.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-800/60">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{page.title || '(Untitled)'}</div>
                              <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Section: {page.tab_name ?? 'Unknown section'}</div>
                              <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Deleted: {formatDate(page.deleted_at)}</div>
                              {isBlocked && (
                                <div className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">Restore the deleted section first.</div>
                              )}
                            </div>
                            <button
                              onClick={() => { void handleRestorePage(page.id); }}
                              disabled={isBlocked || restoringKey === `page:${page.id}`}
                              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:border-emerald-400 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/50"
                            >
                              <RotateCcw size={11} className={restoringKey === `page:${page.id}` ? 'animate-spin' : ''} />
                              Restore
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
