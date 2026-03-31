// src/lib/markdown.js
// remark/rehype pipeline for rendering raw markdown strings from the DB.

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import rehypeSlug from 'rehype-slug';
import rehypeKatex from 'rehype-katex';
import rehypeShiki from '@shikijs/rehype';
import rehypeStringify from 'rehype-stringify';

const md = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkMath)
  .use(remarkRehype)
  .use(rehypeSlug)
  .use(rehypeKatex)
  .use(rehypeShiki, { themes: { light: 'one-light', dark: 'one-dark-pro' } })
  .use(rehypeStringify);

export async function renderMarkdown(body) {
  const result = await md.process(body);
  return String(result);
}

export function extractHeadings(html) {
  const pattern = /<h([1-6])[^>]*\sid="([^"]+)"[^>]*>(.*?)<\/h\1>/gi;
  const headings = [];
  let match;
  while ((match = pattern.exec(html)) !== null) {
    headings.push({
      level: parseInt(match[1], 10),
      id:    match[2],
      text:  match[3].replace(/<[^>]+>/g, '').trim(),
    });
  }
  return headings;
}
