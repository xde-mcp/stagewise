/**
 * Structured representation of a single environment change.
 * Used by all compute*Changes functions for consistent rendering.
 */
export interface EnvironmentChangeEntry {
  /** Discriminator following `domain-action` convention */
  type: string;
  /** Human-readable one-line summary */
  summary: string;
  /** Rich detail content (e.g. unified diff for file content changes) */
  detail?: string;
  /** Extra key-value pairs rendered as XML attributes (e.g. path) */
  attributes?: Record<string, string>;
}

/**
 * Renders an array of environment change entries into the
 * `<env-changes>` XML block consumed by the model.
 */
export function renderEnvironmentChangesXml(
  entries: EnvironmentChangeEntry[],
): string {
  if (entries.length === 0) return '';

  const lines = entries.map((entry) => {
    const attrs = Object.entries(entry.attributes ?? {})
      .map(
        ([k, v]) =>
          ` ${k}="${v.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`,
      )
      .join('');

    const body = entry.detail
      ? `${entry.summary}\n${entry.detail}`
      : entry.summary;

    const needsCdata = body.includes('<') || body.includes('&');
    const wrappedBody = needsCdata
      ? `<![CDATA[${body.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`
      : body;

    return `<entry type="${entry.type}"${attrs}>${wrappedBody}</entry>`;
  });

  return `<env-changes>\n${lines.join('\n')}\n</env-changes>`;
}
