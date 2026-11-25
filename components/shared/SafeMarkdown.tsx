'use client';

import React from 'react';

// NS-FND-005 & NS-FND-006: Safe React JSX Markdown renderer (no dangerouslySetInnerHTML)

interface SafeMarkdownProps {
  content: string;
  className?: string;
}

function sanitizeHref(rawHref: string): string | null {
  const trimmed = rawHref.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('/')) {
    return trimmed.startsWith('//') ? null : trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
  } catch {
    return null;
  }
  return null;
}

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const tokens: React.ReactNode[] = [];
  // Matches [label](url), **bold**, *italic*, or `code`
  const pattern = /(\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(text.slice(lastIndex, match.index));
    }

    if (match[2] && match[3]) {
      const safeHref = sanitizeHref(match[3]);
      if (safeHref) {
        const isExternal = safeHref.startsWith('http');
        tokens.push(
          <a
            key={`${keyPrefix}-lnk-${idx++}`}
            href={safeHref}
            target={isExternal ? '_blank' : undefined}
            rel={isExternal ? 'noopener noreferrer' : undefined}
            className="font-semibold text-foreground underline underline-offset-2 hover:opacity-80"
          >
            {match[2]}
          </a>
        );
      } else {
        tokens.push(match[2]);
      }
    } else if (match[4]) {
      tokens.push(
        <strong key={`${keyPrefix}-b-${idx++}`} className="font-semibold text-foreground">
          {match[4]}
        </strong>
      );
    } else if (match[5]) {
      tokens.push(
        <em key={`${keyPrefix}-i-${idx++}`} className="italic">
          {match[5]}
        </em>
      );
    } else if (match[6]) {
      tokens.push(
        <code
          key={`${keyPrefix}-c-${idx++}`}
          className="px-1.5 py-0.5 rounded-md bg-muted font-numeric text-[11px] text-foreground border border-border"
        >
          {match[6]}
        </code>
      );
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    tokens.push(text.slice(lastIndex));
  }

  return tokens;
}

export function SafeMarkdown({ content, className = '' }: SafeMarkdownProps) {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    if (trimmed.startsWith('### ')) {
      blocks.push(
        <h4
          key={`h3-${i}`}
          className="font-sans text-sm font-bold text-foreground pt-2 first:pt-0"
        >
          {renderInline(trimmed.slice(4), `h3-${i}`)}
        </h4>
      );
      i += 1;
      continue;
    }

    if (trimmed.startsWith('## ')) {
      blocks.push(
        <h3
          key={`h2-${i}`}
          className="font-sans text-base font-bold text-foreground pt-3 first:pt-0 border-b border-border/60 pb-1.5"
        >
          {renderInline(trimmed.slice(3), `h2-${i}`)}
        </h3>
      );
      i += 1;
      continue;
    }

    if (trimmed.startsWith('# ')) {
      blocks.push(
        <h2
          key={`h1-${i}`}
          className="font-sans text-lg sm:text-xl font-bold text-foreground pt-1 first:pt-0"
        >
          {renderInline(trimmed.slice(2), `h1-${i}`)}
        </h2>
      );
      i += 1;
      continue;
    }

    if (trimmed.startsWith('> ')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('> ')) {
        quoteLines.push(lines[i].trim().slice(2));
        i += 1;
      }
      blocks.push(
        <blockquote
          key={`bq-${i}`}
          className="border-l-2 border-foreground/40 bg-muted/50 rounded-r-xl px-4 py-3 text-xs text-muted-foreground leading-relaxed"
        >
          {renderInline(quoteLines.join(' '), `bq-${i}`)}
        </blockquote>
      );
      continue;
    }

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const items: string[] = [];
      while (
        i < lines.length &&
        (lines[i].trim().startsWith('- ') || lines[i].trim().startsWith('* '))
      ) {
        items.push(lines[i].trim().slice(2));
        i += 1;
      }
      blocks.push(
        <ul key={`ul-${i}`} className="space-y-1.5 pl-4 list-disc text-xs sm:text-sm text-foreground/90 leading-relaxed">
          {items.map((item, idx) => (
            <li key={`ul-${i}-${idx}`}>{renderInline(item, `ul-${i}-${idx}`)}</li>
          ))}
        </ul>
      );
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
        i += 1;
      }
      blocks.push(
        <ol
          key={`ol-${i}`}
          className="space-y-1.5 pl-5 list-decimal text-xs sm:text-sm text-foreground/90 leading-relaxed"
        >
          {items.map((item, idx) => (
            <li key={`ol-${i}-${idx}`}>{renderInline(item, `ol-${i}-${idx}`)}</li>
          ))}
        </ol>
      );
      continue;
    }

    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].trim().startsWith('#') &&
      !lines[i].trim().startsWith('> ') &&
      !lines[i].trim().startsWith('- ') &&
      !lines[i].trim().startsWith('* ') &&
      !/^\d+\.\s+/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i].trim());
      i += 1;
    }
    blocks.push(
      <p key={`p-${i}`} className="text-xs sm:text-sm text-foreground/90 leading-relaxed">
        {renderInline(paraLines.join(' '), `p-${i}`)}
      </p>
    );
  }

  return <div className={`space-y-3 ${className}`}>{blocks}</div>;
}
