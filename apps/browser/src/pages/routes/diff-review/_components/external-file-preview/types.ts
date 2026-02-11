/** Shared type for content fetching function */
export type GetContentFn = (oid: string) => Promise<{
  content: string;
  mimeType: string | null;
} | null>;

/** Common props for file type preview components */
export type FilePreviewProps = {
  oid: string | null;
  getContent: GetContentFn;
  filePath: string;
};
