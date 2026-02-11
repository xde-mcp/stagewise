import { memo, type FC } from 'react';
import { IconDatabaseFillDuo18 } from 'nucleo-ui-fill-duo-18';
import { IconArrowRightFill18 } from 'nucleo-ui-fill-18';
import { useKartonProcedure } from '@/hooks/use-karton';
import type { ExternalFileDiff } from '@shared/karton-contracts/ui/shared-types';
import { ImagePreview } from './image-preview';
import { FontPreview } from './font-preview';
import { isImageFile, isFontFile } from './utils';

type ExternalFilePreviewProps = {
  fileDiff: ExternalFileDiff;
};

export const ExternalFilePreview: FC<ExternalFilePreviewProps> = memo(
  ({ fileDiff }) => {
    const getExternalFileContent = useKartonProcedure(
      (p) => p.getExternalFileContent,
    );

    const isImage = isImageFile(fileDiff.path);
    const isFont = isFontFile(fileDiff.path);
    const { changeType, baselineOid, currentOid } = fileDiff;

    // For images, show before/after comparison
    if (isImage) {
      return (
        <div className="p-4">
          {changeType === 'created' && (
            <div className="flex justify-center">
              <div className="w-full max-w-md">
                <ImagePreview
                  oid={currentOid}
                  getContent={getExternalFileContent}
                  filePath={fileDiff.path}
                />
              </div>
            </div>
          )}

          {changeType === 'deleted' && (
            <div className="flex justify-center">
              <div className="w-full max-w-md">
                <ImagePreview
                  oid={baselineOid}
                  getContent={getExternalFileContent}
                  filePath={fileDiff.path}
                />
              </div>
            </div>
          )}

          {changeType === 'modified' && (
            <div className="flex items-center justify-center gap-8">
              <ImagePreview
                oid={baselineOid}
                getContent={getExternalFileContent}
                filePath={fileDiff.path}
              />
              <IconArrowRightFill18 className="size-4 text-muted-foreground" />
              <ImagePreview
                oid={currentOid}
                getContent={getExternalFileContent}
                filePath={fileDiff.path}
              />
            </div>
          )}
        </div>
      );
    }

    // For fonts, show font preview with sample text
    if (isFont) {
      return (
        <div className="p-4">
          {changeType === 'created' && (
            <FontPreview
              oid={currentOid}
              getContent={getExternalFileContent}
              filePath={fileDiff.path}
            />
          )}

          {changeType === 'deleted' && (
            <FontPreview
              oid={baselineOid}
              getContent={getExternalFileContent}
              filePath={fileDiff.path}
            />
          )}

          {changeType === 'modified' && (
            <div className="flex flex-col gap-4">
              <div>
                <div className="mb-2 text-muted-foreground text-xs">Before</div>
                <FontPreview
                  oid={baselineOid}
                  getContent={getExternalFileContent}
                  filePath={fileDiff.path}
                />
              </div>
              <div className="flex justify-center">
                <IconArrowRightFill18 className="size-4 rotate-90 text-muted-foreground" />
              </div>
              <div>
                <div className="mb-2 text-muted-foreground text-xs">After</div>
                <FontPreview
                  oid={currentOid}
                  getContent={getExternalFileContent}
                  filePath={fileDiff.path}
                />
              </div>
            </div>
          )}
        </div>
      );
    }

    // For other binary files, show a placeholder
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <IconDatabaseFillDuo18 className="size-12" />
          <span className="font-normal text-muted-foreground text-xs">
            Binary file
          </span>
        </div>
      </div>
    );
  },
);
