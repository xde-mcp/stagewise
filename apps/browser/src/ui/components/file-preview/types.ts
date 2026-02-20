export type ImagePreviewProps = {
  base64Content: string | null;
  mimeType?: string | null;
  filePath: string;
  isLoading?: boolean;
  error?: string | null;
};

export type FontPreviewProps = {
  base64Content: string | null;
  mimeType?: string | null;
  filePath: string;
  isLoading?: boolean;
  error?: string | null;
};
