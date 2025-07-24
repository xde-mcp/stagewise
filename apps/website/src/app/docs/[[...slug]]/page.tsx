import { source } from '@/lib/source';
import {
  DocsPage,
  DocsBody,
  DocsDescription,
  DocsTitle,
} from 'fumadocs-ui/page';
import { notFound } from 'next/navigation';
import { createRelativeLink } from 'fumadocs-ui/mdx';
import { getMDXComponents } from '@/mdx-components';
import { CopyMarkdownButton } from '@/components/copy-markdown-button';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export default async function Page(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const MDXContent = page.data.body;

  // Get the raw markdown content for the copy button
  let markdownContent = '';
  try {
    const slug = params.slug?.join('/') || 'index';
    const filePath = join(process.cwd(), 'content/docs', `${slug}.mdx`);
    markdownContent = readFileSync(filePath, 'utf-8');
    // Remove frontmatter and export statements
  } catch (_error) {
    // Fallback if file reading fails
    markdownContent = page.data.title || '';
  }

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <div className="relative">
        <div className="absolute top-0 right-0 z-10">
          <CopyMarkdownButton content={markdownContent} />
        </div>
        <DocsTitle>{page.data.title}</DocsTitle>
        <DocsDescription>{page.data.description}</DocsDescription>
      </div>
      <DocsBody>
        <MDXContent
          components={getMDXComponents({
            // this allows you to link to other pages with relative file paths
            a: createRelativeLink(source, page),
          })}
        />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  return {
    title: page.data.title,
    description: page.data.description,
  };
}
