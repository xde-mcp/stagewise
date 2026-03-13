import posthog from 'posthog-js';
import { ChevronLeft, SquareDashedMousePointer } from 'lucide-react';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { getTruncatedFileUrl } from '@ui/utils';
import { useFileIDEHref } from '@ui/hooks/use-file-ide-href';
import { IdePickerPopover } from '@ui/components/ide-picker-popover';
import { useKartonState, useKartonProcedure } from '@ui/hooks/use-karton';
import { useMessageAttachments } from '@ui/hooks/use-message-elements';
import { Button } from '@stagewise/stage-ui/components/button';
import { OverlayScrollbar } from '@stagewise/stage-ui/components/overlay-scrollbar';
import { PreviewCardContent } from '@stagewise/stage-ui/components/preview-card';
import { cn } from '@stagewise/stage-ui/lib/utils';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@stagewise/stage-ui/components/tooltip';
import { IdeLogo } from '@ui/components/ide-logo';
import { IconOpenExternalOutline18 } from 'nucleo-ui-outline-18';
import type { ElementAttachmentAttrs } from '../types';
import type { InlineNodeViewProps } from '../../shared/types';
import { truncateLabel, InlineBadge, InlineBadgeWrapper } from '../../shared';
import type { SelectedElement } from '@shared/selected-elements';

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
 * Element is passed from parent to avoid duplicate lookup.
 */
function ElementPreviewContent({
  element: selectedElement,
}: {
  element: SelectedElement | undefined;
}) {
  const openInIdeSelection = useKartonState(
    (s) => s.globalConfig.openFilesInIde,
  );
  const tabs = useKartonState((s) => s.browser.tabs);
  const switchTab = useKartonProcedure((p) => p.browser.switchTab);
  const scrollToElement = useKartonProcedure((p) => p.browser.scrollToElement);
  const checkElementExists = useKartonProcedure(
    (p) => p.browser.checkElementExists,
  );
  const { getFileIDEHref, needsIdePicker, pickIdeAndOpen } = useFileIDEHref();
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
        const noDataPresent =
          !selectedElement?.tabId ||
          !selectedElement?.backendNodeId ||
          !selectedElement?.frameId;
        const exists = noDataPresent
          ? false
          : await checkElementExists(
              selectedElement.tabId!,
              selectedElement.backendNodeId!,
              selectedElement.frameId!,
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
      const noDataPresent =
        !selectedElement?.tabId ||
        !selectedElement?.backendNodeId ||
        !selectedElement?.frameId;
      setTimeout(async () => {
        if (!noDataPresent)
          await scrollToElement(
            selectedElement.tabId!,
            selectedElement.backendNodeId!,
            selectedElement.frameId!,
          );
      }, 100);
    } catch (error) {
      console.error('Failed to scroll to element:', error);
      posthog.captureException(
        error instanceof Error ? error : new Error(String(error)),
        { source: 'renderer', operation: 'scrollToElement' },
      );
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
              {isUrl(selectedElement.attributes[attribute]!) ? (
                <a
                  href={selectedElement.attributes[attribute]!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full break-all font-mono text-2xs text-primary-foreground leading-tight hover:text-hover-derived"
                >
                  {selectedElement.attributes[attribute]!}{' '}
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
                {selectedElement.codeMetadata.slice(0, 10).map((metadata) => {
                  const anchor = (
                    <a
                      href={
                        needsIdePicker
                          ? '#'
                          : getFileIDEHref(
                              metadata.relativePath,
                              metadata.startLine,
                            )
                      }
                      target={needsIdePicker ? undefined : '_blank'}
                      rel="noopener noreferrer"
                      onClick={
                        needsIdePicker ? (e) => e.preventDefault() : undefined
                      }
                      className="flex shrink basis-4/5 gap-1 break-all text-foreground text-sm hover:text-primary"
                    >
                      <IdeLogo
                        ide={openInIdeSelection}
                        className="size-3 shrink-0"
                      />
                      {getTruncatedFileUrl(metadata.relativePath)}
                    </a>
                  );

                  return (
                    <div
                      key={`${metadata.relativePath}|${metadata.startLine}`}
                      className="flex flex-col items-stretch"
                    >
                      {needsIdePicker ? (
                        <IdePickerPopover
                          onSelect={(ide) =>
                            pickIdeAndOpen(
                              ide,
                              metadata.relativePath,
                              metadata.startLine,
                            )
                          }
                        >
                          {anchor}
                        </IdePickerPopover>
                      ) : (
                        <Tooltip>
                          <TooltipTrigger>{anchor}</TooltipTrigger>
                          <TooltipContent>{metadata.relation}</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  );
                })}
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
 * Looks up element data from context to get the proper label.
 */
export function ElementAttachmentView(props: InlineNodeViewProps) {
  const attrs = props.node.attrs as ElementAttachmentAttrs;

  const isEditable = !('viewOnly' in props);

  // Look up element data from context
  const { elements } = useMessageAttachments();
  const element = useMemo(
    () => elements.find((el) => el.stagewiseId === attrs.id),
    [elements, attrs.id],
  );

  // Prefer context data (saved attachments), fall back to attrs (new attachments being composed)
  const label = useMemo(() => {
    if (element) {
      const tagName = (element.nodeType || element.tagName || '').toLowerCase();
      const domId = element.attributes?.id ? `#${element.attributes.id}` : '';
      return `${tagName}${domId}` || attrs.label;
    }
    return attrs.label;
  }, [element, attrs.label]);

  const displayLabel = useMemo(
    () => truncateLabel(label, attrs.id),
    [label, attrs.id],
  );

  const icon = <SquareDashedMousePointer className="size-3 shrink-0" />;

  const previewContent = <ElementPreviewContent element={element} />;

  return (
    <InlineBadgeWrapper viewOnly={!isEditable} previewContent={previewContent}>
      <InlineBadge
        icon={icon}
        label={displayLabel}
        selected={props.selected}
        isEditable={isEditable}
        onDelete={() =>
          'deleteNode' in props ? props.deleteNode() : undefined
        }
      />
    </InlineBadgeWrapper>
  );
}
