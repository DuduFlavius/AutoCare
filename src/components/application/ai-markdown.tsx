'use client';

import { Fragment, type ReactNode } from 'react';

/** Render a restricted Markdown subset as React nodes. Never inject HTML or execute model output. */
function inline(source: string): ReactNode[] {
  const tokens = source.split(/(\[(?:[^\]]+)\]\((?:https?:\/\/[^\s)]+)\)|\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`]+`)/g);
  const nodes: ReactNode[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const part = tokens[i];
    if (!part) continue;
    if (part.startsWith('[') && /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/.test(part)) {
      const match = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/.exec(part)!;
      try {
        const url = new URL(match[2]);
        if (url.protocol === 'https:' || url.protocol === 'http:') {
          nodes.push(<a key={i} href={url.href} target="_blank" rel="noopener noreferrer nofollow">{match[1]}</a>);
          continue;
        }
      } catch { /* render as text */ }
    }
    if (part.startsWith('**') && part.endsWith('**')) nodes.push(<strong key={i}>{part.slice(2, -2)}</strong>);
    else if (part.startsWith('*') && part.endsWith('*')) nodes.push(<em key={i}>{part.slice(1, -1)}</em>);
    else if (part.startsWith('`') && part.endsWith('`')) nodes.push(<code key={i}>{part.slice(1, -1)}</code>);
    else nodes.push(<Fragment key={i}>{part}</Fragment>);
  }
  return nodes;
}

export function AiMarkdown({ text }: { text: string }) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { blocks.push(<hr key={i}/>); i++; continue; }
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      blocks.push(<h4 key={i} className="ac-ai-md-heading">{inline(heading[2])}</h4>);
      i++; continue;
    }
    if (/^```/.test(line)) {
      const start = i++;
      const code: string[] = [];
      while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]);
      if (i < lines.length) i++;
      blocks.push(<pre key={start}><code>{code.join('\n')}</code></pre>);
      continue;
    }
    if (line.includes('|') && i + 1 < lines.length && /^\s*\|?\s*:?-{3,}:?/.test(lines[i + 1])) {
      const start = i;
      const cells = (row: string) => row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(s => s.trim());
      const headers = cells(lines[i]); i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) rows.push(cells(lines[i++]));
      blocks.push(<div className="ac-ai-table-scroll" key={start}><table><thead><tr>{headers.map((h, j) => <th key={j}>{inline(h)}</th>)}</tr></thead><tbody>{rows.map((row, j) => <tr key={j}>{headers.map((_, k) => <td key={k}>{inline(row[k] || '')}</td>)}</tr>)}</tbody></table></div>);
      continue;
    }
    if (/^\s*([-*+]\s+|\d+\.\s+)/.test(line)) {
      const start = i;
      const ordered = /^\s*\d+\.\s+/.test(line);
      const items: ReactNode[] = [];
      while (i < lines.length && /^\s*([-*+]\s+|\d+\.\s+)/.test(lines[i])) {
        items.push(<li key={i}>{inline(lines[i].replace(/^\s*(?:[-*+]\s+|\d+\.\s+)/, ''))}</li>); i++;
      }
      blocks.push(ordered ? <ol key={start}>{items}</ol> : <ul key={start}>{items}</ul>);
      continue;
    }
    if (/^>\s?/.test(line)) {
      const start = i; const parts: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) parts.push(lines[i++].replace(/^>\s?/, ''));
      blocks.push(<blockquote key={start}>{inline(parts.join(' '))}</blockquote>);
      continue;
    }
    const start = i; const paragraph: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|```|>\s|\s*[-*+]\s|\s*\d+\.\s)/.test(lines[i])) paragraph.push(lines[i++]);
    if (!paragraph.length) { i++; continue; }
    blocks.push(<p key={start}>{inline(paragraph.join(' '))}</p>);
  }
  return <div className="ac-ai-markdown">{blocks}</div>;
}
