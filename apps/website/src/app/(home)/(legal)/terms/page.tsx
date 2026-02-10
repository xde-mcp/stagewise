import { legal } from '@/lib/source';
import { getMDXComponents } from '@/mdx-components';
import { notFound } from 'next/navigation';

export default async function TermsPage() {
  const page = legal.getPage(['terms']);
  if (!page) notFound();

  const MDXContent = page.data.body;

  return (
    <div className="prose mx-auto w-full max-w-7xl px-4">
      <MDXContent components={getMDXComponents({})} />
    </div>
  );
}
