import { ChevronLeft, SquareDashedMousePointer } from 'lucide-react';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { usePostHog } from 'posthog-js/react';
import { getTruncatedFileUrl } from '@/utils';
import { useFileIDEHref } from '@/hooks/use-file-ide-href';
import { useKartonState, useKartonProcedure } from '@/hooks/use-karton';
import { useMessageEditState } from '@/hooks/use-message-edit-state';
import { useMessageElements } from '@/hooks/use-message-elements';
import { Button } from '@stagewise/stage-ui/components/button';
import { OverlayScrollbar } from '@stagewise/stage-ui/components/overlay-scrollbar';
import { PreviewCardContent } from '@stagewise/stage-ui/components/preview-card';
import { cn } from '@stagewise/stage-ui/lib/utils';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@stagewise/stage-ui/components/tooltip';
import { IdeLogo } from '@/components/ide-logo';
import { IconOpenExternalOutline18 } from 'nucleo-ui-outline-18';
import type { ElementAttachmentAttrs, AttachmentNodeViewProps } from '../types';
import {
  truncateLabel,
  AttachmentBadge,
  AttachmentBadgeWrapper,
} from '../view-utils';

const displayedAttributes = [
  'id',
  'class',
  'name',
  'type',
  'href',
  'src',
  'alt',
  'placeholder',
  'title',
  'aria-label',
  'aria-role',
  'aria-description',
  'aria-hidden',
  'aria-disabled',
  'aria-expanded',
  'aria-selected',
];

function isUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Preview card content showing detailed element information.
 */
function ElementPreviewContent({
  selectedElementId,
}: {
  selectedElementId: string;
}) {
  // Get elements from Karton state
  const selectedElements = useKartonState((s) => s.browser.selectedElements);

  // Get elements from edit state context (for elements that exist only locally during editing)
  const { activeEditMessageId } = useMessageEditState();

  // Get elements from message scope context (for view mode - from message metadata)
  const { elements: messageElements } = useMessageElements();

  const selectedElement = useMemo(() => {
    // First check Karton state
    const fromKarton = selectedElements?.find(
      (element) => element.stagewiseId === selectedElementId,
    );
    if (fromKarton) return fromKarton;

    // Finally, check the message scope context (view mode - from message metadata)
    return messageElements.find(
      (element) => element.stagewiseId === selectedElementId,
    );
  }, [
    selectedElements,
    selectedElementId,
    activeEditMessageId,
    messageElements,
  ]);

  const posthog = usePostHog();
  const openInIdeSelection = useKartonState(
    (s) => s.globalConfig.openFilesInIde,
  );
  const tabs = useKartonState((s) => s.browser.tabs);
  const switchTab = useKartonProcedure((p) => p.browser.switchTab);
  const scrollToElement = useKartonProcedure((p) => p.browser.scrollToElement);
  const checkElementExists = useKartonProcedure(
    (p) => p.browser.checkElementExists,
  );
  const { getFileIDEHref } = useFileIDEHref();
  const [elementExistenceChecked, setElementExistenceChecked] = useState(false);
  const [elementExists, setElementExists] = useState<boolean | null>(null);

  const flattenedReactComponentTree = useMemo(() => {
    // Return the flattened component tree as a list of components. Limit to first 3 components.
    const flattenedComponents = [];
    let currentComponent = selectedElement?.frameworkInfo?.react;
    while (currentComponent && flattenedComponents.length < 5) {
      flattenedComponents.push(currentComponent);
      currentComponent = currentComponent.parent;
    }
    return flattenedComponents;
  }, [selectedElement?.frameworkInfo?.react]);

  // Check if the element exists in the DOM
  useEffect(() => {
    if (!selectedElement?.tabId) {
      setElementExistenceChecked(true);
      setElementExists(false);
      return;
    }

    let cancelled = false;

    const checkExistence = async () => {
      try {
        const exists = await checkElementExists(
          selectedElement?.tabId,
          selectedElement?.backendNodeId,
          selectedElement?.frameId,
        );
        if (!cancelled) {
          setElementExists(exists);
          setElementExistenceChecked(true);
        }
      } catch {
        if (!cancelled) {
          setElementExists(false);
          setElementExistenceChecked(true);
        }
      }
    };

    checkExistence();

    return () => {
      cancelled = true;
    };
  }, [
    selectedElement?.tabId,
    selectedElement?.backendNodeId,
    selectedElement?.frameId,
    checkElementExists,
  ]);

  // Check if the tab exists and if the element exists in the DOM
  const isElementLocationValid = useMemo(() => {
    if (!selectedElement?.tabId) return false;
    const tab = tabs[selectedElement.tabId];
    if (!tab) return false;

    // If we haven't checked yet, return false (button disabled until check completes)
    if (!elementExistenceChecked) return false;
    // Return the result of the element existence check
    return elementExists === true;
  }, [tabs, selectedElement?.tabId, elementExistenceChecked, elementExists]);

  const handleScrollToElement = useCallback(async () => {
    if (!isElementLocationValid || !selectedElement?.tabId) return;

    try {
      // Switch to the tab first
      await switchTab(selectedElement?.tabId);
      // Wait a bit for the tab to be active, then scroll
      setTimeout(async () => {
        await scrollToElement(
          selectedElement?.tabId,
          selectedElement?.backendNodeId,
          selectedElement?.frameId,
        );
      }, 100);
    } catch (error) {
      console.error('Failed to scroll to element:', error);
    }
  }, [
    isElementLocationValid,
    selectedElement?.tabId,
    selectedElement?.backendNodeId,
    selectedElement?.frameId,
    switchTab,
    scrollToElement,
  ]);

  if (!selectedElement) return null;

  return (
    <PreviewCardContent className="gap-2.5">
      <Tooltip>
        <TooltipTrigger>
          <Button
            variant="ghost"
            size="icon-xs"
            className="absolute top-3 right-3 z-10 size-3"
            onClick={(e) => {
              e.stopPropagation();
              handleScrollToElement();
            }}
            disabled={!isElementLocationValid}
          >
            <IconOpenExternalOutline18 />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {isElementLocationValid
            ? 'Scroll to element in tab'
            : elementExistenceChecked
              ? 'Element no longer exists in the DOM'
              : 'Checking if element exists...'}
        </TooltipContent>
      </Tooltip>
      <OverlayScrollbar
        className="max-h-[35vh] max-w-72"
        contentClassName="flex flex-col gap-2.5 *:shrink-0"
      >
        <div className="flex flex-col items-stretch justify-start">
          <p className="font-medium text-foreground text-xs">XPath</p>
          <div className="w-full break-all font-mono text-2xs text-muted-foreground leading-tight">
            {selectedElement.xpath}
          </div>
        </div>
        {selectedElement.frameLocation && (
          <div className="flex flex-col items-stretch justify-start">
            <p className="font-medium text-foreground text-xs">
              Frame Location
            </p>
            <div className="w-full break-all font-mono text-2xs text-muted-foreground leading-tight">
              {selectedElement.frameLocation}
            </div>
            {!selectedElement.isMainFrame && (
              <p className="text-2xs text-muted-foreground italic leading-tight">
                Located within frame (iframe, etc.)
              </p>
            )}
          </div>
        )}
        {selectedElement.frameTitle && (
          <div className="flex flex-col items-stretch justify-start">
            <p className="font-medium text-foreground text-xs">Frame Title</p>
            <div className="w-full break-all font-mono text-2xs text-muted-foreground leading-tight">
              {selectedElement.frameTitle}
            </div>
          </div>
        )}
        {displayedAttributes
          .filter(
            (attribute) =>
              selectedElement.attributes[attribute] !== null &&
              selectedElement.attributes[attribute] !== '' &&
              selectedElement.attributes[attribute] !== undefined,
          )
          .map((attribute) => (
            <div
              key={attribute}
              className="flex flex-col items-stretch justify-start"
            >
              <p className="font-medium text-foreground text-xs">{attribute}</p>
              {isUrl(selectedElement.attributes[attribute]) ? (
                <a
                  href={selectedElement.attributes[attribute]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full break-all font-mono text-2xs text-primary-foreground leading-tight hover:text-hover-derived"
                >
                  {selectedElement.attributes[attribute]}{' '}
                  <IconOpenExternalOutline18 className="mb-0.5 ml-0.5 inline size-3.5" />
                </a>
              ) : (
                <div className="w-full select-text break-all font-mono text-2xs text-muted-foreground leading-tight">
                  {selectedElement.attributes[attribute]}
                </div>
              )}
            </div>
          ))}

        {selectedElement.frameworkInfo?.react &&
          flattenedReactComponentTree.length > 0 && (
            <div className="flex flex-col items-stretch justify-start gap-0.5 leading-none">
              <p className="font-medium text-foreground text-xs">
                React Component Tree
              </p>
              <div>
                {flattenedReactComponentTree.map((component, index) => {
                  return (
                    <Fragment key={`${component.componentName}-${index}`}>
                      <span
                        className={cn(
                          'font-mono text-2xs text-foreground leading-tight',
                          index === 0 &&
                            'font-semibold text-primary-foreground',
                          index > 1 && 'text-muted-foreground',
                        )}
                      >
                        {component.componentName}
                        {component.isRSC ? '(RSC)' : ''}
                      </span>
                      {index < flattenedReactComponentTree.length - 1 && (
                        <ChevronLeft className="inline-block size-3 text-muted-foreground" />
                      )}
                    </Fragment>
                  );
                })}
              </div>
            </div>
          )}

        {selectedElement.codeMetadata &&
          selectedElement.codeMetadata.length > 0 && (
            <div className="flex flex-col items-stretch justify-start gap-0.5">
              <p className="w-full font-medium text-foreground text-xs">
                Related source files
              </p>
              <div className="flex w-full flex-col items-stretch gap-2">
                {selectedElement.codeMetadata.slice(0, 10).map((metadata) => (
                  <div
                    key={`${metadata.relativePath}|${metadata.startLine}`}
                    className="flex flex-col items-stretch"
                  >
                    <Tooltip>
                      <TooltipTrigger>
                        <a
                          href={getFileIDEHref(
                            metadata.relativePath,
                            metadata.startLine,
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex shrink basis-4/5 gap-1 break-all text-foreground text-sm hover:text-primary"
                          onClick={() => {
                            posthog.capture(
                              'agent_file_opened_in_ide_via_element_context',
                              {
                                file_path: metadata.relativePath,
                                ide: openInIdeSelection,
                                line_number: metadata.startLine,
                              },
                            );
                          }}
                        >
                          <IdeLogo
                            ide={openInIdeSelection}
                            className="size-3 shrink-0"
                          />
                          {getTruncatedFileUrl(metadata.relativePath)}
                        </a>
                      </TooltipTrigger>
                      <TooltipContent>{metadata.relation}</TooltipContent>
                    </Tooltip>
                  </div>
                ))}
              </div>
            </div>
          )}
      </OverlayScrollbar>
    </PreviewCardContent>
  );
}

/**
 * Custom NodeView for element attachments (selected DOM elements).
 * Displays the element with a selector icon and shows a preview card
 * with element details on hover.
 */
export function ElementAttachmentView(props: AttachmentNodeViewProps) {
  const attrs = props.node.attrs as ElementAttachmentAttrs;

  const isEditable = !('viewOnly' in props);

  const displayLabel = useMemo(
    () => truncateLabel(attrs.label, attrs.id),
    [attrs.label, attrs.id],
  );

  const icon = <SquareDashedMousePointer className="size-3 shrink-0" />;

  const previewContent = <ElementPreviewContent selectedElementId={attrs.id} />;

  return (
    <AttachmentBadgeWrapper
      viewOnly={!isEditable}
      previewContent={previewContent}
    >
      <AttachmentBadge
        icon={icon}
        label={displayLabel}
        selected={props.selected}
        isEditable={isEditable}
        onDelete={() =>
          'deleteNode' in props ? props.deleteNode() : undefined
        }
      />
    </AttachmentBadgeWrapper>
  );
}
