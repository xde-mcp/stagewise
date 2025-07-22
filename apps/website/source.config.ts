import {
  defineDocs,
  defineConfig,
  defineCollections,
  frontmatterSchema,
} from 'fumadocs-mdx/config';
import { z } from 'zod';

// Options: https://fumadocs.vercel.app/docs/mdx/collections#define-docs
export const docs = defineDocs({
  dir: 'content/docs',
});

export const blogPosts = defineCollections({
  type: 'doc',
  dir: 'content/blog',
  // add required frontmatter properties
  schema: frontmatterSchema.extend({
    author: z.string(),
    date: z.string().date().or(z.date()),
  }),
});

export const legalTexts = defineDocs({
  dir: 'content/legal',
});

export default defineConfig({
  mdxOptions: {
    // MDX options
  },
});
