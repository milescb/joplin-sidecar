// src/lib/markdown.js
// remark/rehype pipeline for rendering raw markdown strings from the DB.

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import rehypeKatex from 'rehype-katex';
import rehypeShiki from '@shikijs/rehype';
import rehypeStringify from 'rehype-stringify';

const md = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkMath)
  .use(remarkRehype)
  .use(rehypeKatex)
  .use(rehypeShiki, { theme: 'one-light' })
  .use(rehypeStringify);

export async function renderMarkdown(body) {
  const result = await md.process(body);
  return String(result);
}
