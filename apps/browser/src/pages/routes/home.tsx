import { createFileRoute } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  useKartonProcedure,
  useKartonState,
  useKartonConnected,
} from '@/hooks/use-karton';
import type {
  InspirationWebsite,
  LocalPortEntry,
  RecentlyOpenedWorkspace,
} from '@shared/karton-contracts/pages-api/types';
import { Button } from '@stagewise/stage-ui/components/button';
import { Skeleton } from '@stagewise/stage-ui/components/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@stagewise/stage-ui/components/tooltip';
import {
  IconArrowLeftOutline18,
  IconArrowRightOutline18,
  IconChevronDownOutline18,
  IconCircleQuestionOutline18,
  IconFolder5OpenOutline18,
  IconRefreshClockwiseOutline18,
} from 'nucleo-ui-outline-18';
import { IconFolderFillDuo18, IconEarthFillDuo18 } from 'nucleo-ui-fill-duo-18';
import TimeAgo from 'react-timeago';
import { cn } from '@/utils';
import { useScrollFadeMask } from '@ui/hooks/use-scroll-fade-mask';
import { LogoWithText } from '@ui/components/ui/logo-with-text';
import { OverlayScrollbar } from '@stagewise/stage-ui/components/overlay-scrollbar';
import { LogoText } from '@stagewise/stage-ui/components/logo-text';
import LogoImage from '@assets/icons/icon-64.png';

export const Route = createFileRoute('/home')({
  component: HomePage,
  head: () => ({
    meta: [
      {
        title: 'Home',
      },
    ],
  }),
});

// Text slideshow component for the inspiration section
function TextSlideshow({
  texts,
  className,
}: {
  texts: string[];
  className?: string;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % texts.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [texts.length]);

  return <span className={className}>{texts[currentIndex]}</span>;
}

function HomePage() {
  const isConnected = useKartonConnected();
  const hasSeenOnboardingFlow = useKartonState(
    (s) => s.homePage.storedExperienceData.hasSeenOnboardingFlow,
  );

  if (!isConnected) {
    return (
      <div className="flex size-full min-h-screen min-w-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <LogoWithText />
          <span className="text-muted-foreground text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex size-full min-h-screen min-w-screen flex-col items-center justify-center overflow-hidden bg-background">
      {!hasSeenOnboardingFlow ? (
        <OnboardingStartPage />
      ) : (
        <StartPageWithConnectedWorkspace />
      )}
    </div>
  );
}

function StartPageWithConnectedWorkspace() {
  const openTab = useKartonProcedure((p) => p.openTab);
  const getInspirationWebsites = useKartonProcedure(
    (p) => p.getInspirationWebsites,
  );
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { maskStyle } = useScrollFadeMask(scrollContainerRef, {
    axis: 'horizontal',
    fadeDistance: 32,
  });
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  // Local state for inspiration websites (fetched on demand)
  const [inspirationWebsites, setInspirationWebsites] =
    useState<InspirationWebsite>({
      websites: [],
      total: 0,
      seed: '',
    });

  // Initial fetch of inspiration websites
  useEffect(() => {
    let cancelled = false;
    getInspirationWebsites({ offset: 0, limit: 10 }).then((result) => {
      if (!cancelled) setInspirationWebsites(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Load more websites
  const loadMoreWebsites = useCallback(async () => {
    if (isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const result = await getInspirationWebsites({
        offset: inspirationWebsites.websites.length,
        limit: 10,
      });
      setInspirationWebsites((prev) => ({
        websites: [...prev.websites, ...result.websites],
        total: result.total,
        seed: result.seed,
      }));
    } finally {
      setIsLoadingMore(false);
    }
  }, [
    getInspirationWebsites,
    inspirationWebsites.websites.length,
    isLoadingMore,
  ]);

  // Update scroll button visibility
  const updateScrollButtons = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const { scrollLeft, scrollWidth, clientWidth } = container;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 1);
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollLeft, scrollWidth, clientWidth } = container;
      const hasMoreWebsites =
        inspirationWebsites.websites.length < inspirationWebsites.total;
      const isNearEnd = scrollLeft + clientWidth >= scrollWidth - 400;

      if (isNearEnd && !isLoadingMore && hasMoreWebsites) {
        loadMoreWebsites();
      }

      // Update scroll button visibility
      updateScrollButtons();
    };

    container.addEventListener('scroll', handleScroll);
    // Initial check
    updateScrollButtons();
    return () => container.removeEventListener('scroll', handleScroll);
  }, [
    inspirationWebsites.websites.length,
    inspirationWebsites.total,
    isLoadingMore,
    loadMoreWebsites,
    updateScrollButtons,
  ]);

  // Scroll by 2 items (card width 256px + gap 16px = 272px per item)
  const scrollByItems = useCallback((direction: 'left' | 'right') => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const itemWidth = 272; // w-64 (256px) + gap-4 (16px)
    const scrollAmount = itemWidth * 2;
    container.scrollBy({
      left: direction === 'right' ? scrollAmount : -scrollAmount,
      behavior: 'smooth',
    });
  }, []);

  const inspirationWebsitesWithScreenshot = useMemo(() => {
    return {
      websites: inspirationWebsites.websites.filter(
        (website) => website.screenshot_url !== null,
      ),
      total: inspirationWebsites.total,
      seed: inspirationWebsites.seed,
    };
  }, [inspirationWebsites]);

  const handleWebsiteClick = useCallback(
    (url: string, event?: React.MouseEvent) => {
      // Check if CMD (Mac) or CTRL (Windows/Linux) is pressed
      const isModifierPressed = event?.metaKey || event?.ctrlKey;
      if (!isModifierPressed) window.location.href = url;
      else openTab(url, false);
    },
    [openTab],
  );

  const releaseChannel = useKartonState((s) => s.appInfo.releaseChannel);

  return (
    <div className="flex w-full max-w-7xl flex-col items-start gap-8 px-20">
      <div className="flex items-center gap-2">
        <img src={LogoImage} alt="stagewise Logo" className="size-8" />
        <LogoText className="h-8 text-foreground" />
        {releaseChannel === 'dev' && (
          <span className="ml-2 rounded-full border border-derived bg-warning-background px-2 py-px text-sm text-warning-foreground">
            Development Build
          </span>
        )}
        {releaseChannel === 'prerelease' && (
          <span className="ml-2 rounded-full border border-derived px-2 py-px text-primary-foreground text-sm">
            Pre-Release Build
          </span>
        )}
      </div>
      <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-2">
        <ConnectWorkspaceBanner />
        <LocalPortsSection />
      </div>
      {inspirationWebsitesWithScreenshot.websites.length > 0 && (
        <div className="group/design-inspiration mt-2 flex w-full flex-col items-center justify-start gap-4">
          <div className="relative z-10 flex w-full items-center justify-between">
            <h1 className="font-medium text-xl">
              <TextSlideshow
                className="text-foreground"
                texts={[
                  'Grab components from',
                  'Grab styles from',
                  'Understand the layout of',
                  'Grab colors from',
                  'Grab themes from',
                  'Grab fonts from',
                ]}
              />
            </h1>
            <div className="flex items-center gap-1">
              {canScrollLeft && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => scrollByItems('left')}
                  aria-label="Scroll left"
                >
                  <IconArrowLeftOutline18 className="size-4" />
                </Button>
              )}
              {canScrollRight && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => scrollByItems('right')}
                  aria-label="Scroll right"
                >
                  <IconArrowRightOutline18 className="size-4" />
                </Button>
              )}
            </div>
          </div>
          <div
            ref={scrollContainerRef}
            className="mask-alpha scrollbar-none -my-12 flex w-[calc(100%+4rem)] justify-start gap-4 overflow-x-auto px-8 py-12"
            style={maskStyle}
          >
            {inspirationWebsitesWithScreenshot.websites.map((website) => (
              <DesignInspirationCard
                key={website.url}
                website={website}
                onClick={(event) => handleWebsiteClick(website.url, event)}
              />
            ))}
            {isLoadingMore &&
              inspirationWebsitesWithScreenshot.websites.length <
                inspirationWebsitesWithScreenshot.total &&
              Array.from({ length: 5 }, (_, index) => (
                <DesignInspirationSkeletonCard
                  key={`skeleton-${inspirationWebsitesWithScreenshot.websites.length}-${index}`}
                />
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function OnboardingStartPage() {
  const openWorkspace = useKartonProcedure((p) => p.openWorkspace);
  const setHasSeenOnboardingFlow = useKartonProcedure(
    (p) => p.setHasSeenOnboardingFlow,
  );

  const selectAndOpenWorkspace = useCallback(async () => {
    await openWorkspace(undefined);
  }, [openWorkspace]);

  const releaseChannel = useKartonState((s) => s.appInfo.releaseChannel);

  return (
    <div className="flex w-full max-w-2xl flex-col items-start gap-4 px-10">
      <div className="flex items-center gap-2">
        <LogoWithText className="h-10 text-foreground" />
        <div className="ml-1 inline-flex shrink-0 items-center font-normal text-warning-foreground text-xs">
          {releaseChannel === 'dev' && 'Development Build'}
          {releaseChannel === 'prerelease' && 'Pre-Release Build'}
        </div>
      </div>
      <div
        className={cn(
          'group/start-page-workspaces mt-2 flex w-full flex-col items-start justify-start gap-4 rounded-lg border border-derived bg-linear-to-tr from-surface-1/70 to-surface-1/50 p-4 dark:bg-surface-1',
        )}
      >
        <div className="flex justify-between gap-20 ">
          <div className="flex flex-col items-start justify-center gap-1">
            <h1 className="flex items-center justify-center gap-2 font-medium text-foreground text-xl">
              Connect a workspace
            </h1>

            <div className="flex w-full max-w-md flex-col items-start justify-center gap-2 text-muted-foreground text-sm">
              Connecting a workspace will give the stagewise agent access to
              your project.
            </div>
          </div>
          <IconFolderFillDuo18 className="size-18" />
        </div>
        <div className="flex w-full items-center justify-end gap-4">
          <Button
            variant={'ghost'}
            size="sm"
            className="mt-2 rounded-lg p-2"
            onClick={() => setHasSeenOnboardingFlow(true)}
          >
            Connect later
          </Button>
          <Button
            variant={'primary'}
            size="sm"
            className="mt-2 rounded-lg p-2"
            onClick={async () => {
              setHasSeenOnboardingFlow(true);
              await selectAndOpenWorkspace();
            }}
          >
            <IconFolder5OpenOutline18 className="size-4" />
            Connect a workspace
          </Button>
        </div>
      </div>
    </div>
  );
}

function RecentlyOpenedWorkspaceItem({
  workspace,
  onClick,
}: {
  workspace: RecentlyOpenedWorkspace;
  onClick?: () => void;
}) {
  return (
    <div
      className="flex w-full shrink-0 cursor-pointer items-center gap-4 rounded-lg bg-background p-2 pt-1 hover:bg-hover-derived dark:bg-surface-1"
      onClick={onClick}
    >
      <IconFolderFillDuo18 className="size-4 shrink-0 text-muted-foreground" />
      <div className="flex w-full flex-col items-start justify-start gap-0">
        <div className="flex w-full items-baseline justify-start gap-2 text-foreground text-sm">
          <span className="truncate font-normal">{workspace.name}</span>
          <span className="hidden shrink-0 font-normal text-subtle-foreground/l10 text-xs sm:inline dark:text-subtle-foreground/l-8">
            <TimeAgo date={workspace.openedAt} live={false} />
          </span>
        </div>
        <div className="flex w-full items-center justify-between gap-8 rounded-b-lg font-normal text-foreground text-sm">
          <span
            className="min-w-0 self-start truncate font-normal text-subtle-foreground text-xs"
            dir="rtl"
          >
            <span dir="ltr">{workspace.path}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function DesignInspirationSkeletonCard() {
  return (
    <div className="flex w-64 shrink-0 flex-col items-center overflow-hidden rounded-lg border border-derived-strong bg-background shadow-[0_0_6px_0_rgba(0,0,0,0.08),0_-6px_48px_-24px_rgba(0,0,0,0.15)] dark:bg-surface-1">
      <Skeleton className="h-40 w-full rounded-none border-none" />
      <div className="flex w-full items-center justify-between gap-2 p-2 dark:border-derived-strong dark:border-t">
        <Skeleton className="h-4 w-32" />
      </div>
    </div>
  );
}

function DesignInspirationCard({
  website,
  onClick,
}: {
  website: InspirationWebsite['websites'][number];
  onClick: (event: React.MouseEvent) => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const websiteName = useMemo(() => {
    return new URL(website.url).hostname;
  }, [website.url]);

  const websiteFirstRoute: string | null = useMemo(() => {
    return new URL(website.url).pathname.split('/')[1] ?? null;
  }, [website.url]);

  useEffect(() => {
    if (videoRef.current) {
      if (isHovered) {
        videoRef.current.play().catch(() => {
          // Video failed to play, keep showing image
        });
      } else {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
        setIsVideoPlaying(false);
      }
    }
  }, [isHovered]);

  const handleVideoPlaying = useCallback(() => {
    // Double RAF: first RAF queues for next frame, second RAF runs after paint
    // This ensures the video frame is actually rendered before we fade it in
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsVideoPlaying(true);
      });
    });
  }, []);

  return (
    <div
      onClick={(e) => onClick(e)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="flex w-64 shrink-0 cursor-pointer flex-col items-center overflow-hidden rounded-lg border border-derived-strong bg-background text-foreground shadow-elevation-1 transition-shadow duration-300 hover:bg-hover-derived hover:text-hover-derived dark:bg-surface-1"
    >
      <div className="relative h-40 w-full">
        {!isImageLoaded && <Skeleton className="h-40 w-full rounded-none" />}
        <img
          src={website.screenshot_url ?? undefined}
          alt={websiteName}
          onLoad={() => setIsImageLoaded(true)}
          className={cn(
            'absolute inset-0 flex h-full w-full items-center justify-center object-cover transition-opacity duration-200',
            isImageLoaded ? 'opacity-100' : 'opacity-0',
          )}
        />
        {website.screen_video_url && (
          <video
            ref={videoRef}
            src={website.screen_video_url}
            loop
            muted
            playsInline
            preload="auto"
            onPlaying={handleVideoPlaying}
            className={cn(
              'absolute inset-0 flex h-full w-full items-center justify-center object-cover transition-opacity duration-200',
              isVideoPlaying ? 'opacity-100' : 'opacity-0',
            )}
          />
        )}
      </div>
      <div className="flex w-full items-baseline justify-between gap-2 p-2">
        {!isImageLoaded ? (
          <Skeleton className="h-4 w-32" />
        ) : (
          <>
            <span className="truncate font-normal text-foreground text-sm">
              {websiteName}
            </span>
            {websiteFirstRoute && (
              <span className="truncate rounded-md bg-primary-solid/10 px-1.5 py-0.5 font-normal text-primary-foreground text-xs dark:bg-primary-200/10 dark:text-primary-400">
                {websiteFirstRoute}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ConnectWorkspaceBanner() {
  const openWorkspace = useKartonProcedure((p) => p.openWorkspace);
  const getContextFiles = useKartonProcedure((p) => p.getContextFiles);
  const selectAndOpenWorkspace = useCallback(async () => {
    await openWorkspace(undefined);
  }, [openWorkspace]);
  const recentlyOpenedWorkspaces = useKartonState(
    (s) => s.homePage.storedExperienceData.recentlyOpenedWorkspaces,
  );
  const workspaceStatus = useKartonState((s) => s.homePage.workspaceStatus);

  const [currentWorkspacePath, setCurrentWorkspacePath] = useState<
    string | null
  >(null);

  useEffect(() => {
    getContextFiles().then((result) => {
      setCurrentWorkspacePath(result.workspacePath);
    });
  }, [getContextFiles, workspaceStatus]);

  const workspaceName = useMemo(() => {
    if (!currentWorkspacePath) return null;
    return (
      currentWorkspacePath
        .replace(/\\/g, '/')
        .split('/')
        .filter(Boolean)
        .pop() ?? currentWorkspacePath
    );
  }, [currentWorkspacePath]);

  const [showAllRecentlyOpenedWorkspaces, setShowAllRecentlyOpenedWorkspaces] =
    useState(false);

  const sortedRecentlyOpenedWorkspaces = useMemo(() => {
    const allSorted = [...recentlyOpenedWorkspaces].sort(
      (a, b) => b.openedAt - a.openedAt,
    );
    if (showAllRecentlyOpenedWorkspaces) return allSorted;
    else return allSorted.slice(0, 3);
  }, [recentlyOpenedWorkspaces, showAllRecentlyOpenedWorkspaces]);

  const otherRecentWorkspaces = useMemo(
    () =>
      [...recentlyOpenedWorkspaces]
        .sort((a, b) => b.openedAt - a.openedAt)
        .filter((w) => w.path !== currentWorkspacePath),
    [recentlyOpenedWorkspaces, currentWorkspacePath],
  );

  if (workspaceStatus === 'open' && currentWorkspacePath) {
    return (
      <div className="flex w-full flex-col items-start gap-2">
        <div className="flex w-full items-center justify-between">
          <h1 className="flex items-center gap-2 font-medium text-foreground text-xl">
            Workspace
            <Tooltip>
              <TooltipTrigger>
                <IconCircleQuestionOutline18 className="size-4 shrink-0 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <span>
                  Allows stagewise to read and modify files in your workspace.
                </span>
              </TooltipContent>
            </Tooltip>
          </h1>
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 text-xs"
            onClick={selectAndOpenWorkspace}
          >
            <IconFolder5OpenOutline18 className="size-4" />
            Change workspace
          </Button>
        </div>
        <div className="flex w-full flex-1 flex-col items-start gap-0.5 rounded-lg border border-derived-strong bg-background p-2 shadow-[0_0_6px_0_rgba(0,0,0,0.05),0_-6px_48px_-24px_rgba(0,0,0,0.08)] dark:bg-surface-1">
          {/* Active workspace row */}
          <div className="flex w-full shrink-0 items-center gap-4 rounded-md bg-hover-derived p-2 pt-1">
            <IconFolderFillDuo18 className="size-4 shrink-0 text-muted-foreground" />
            <div className="flex w-full min-w-0 flex-col items-start gap-0">
              <div className="flex w-full items-baseline justify-between gap-2 text-foreground text-sm">
                <span className="truncate font-medium">{workspaceName}</span>
                <div className="flex shrink-0 items-center gap-1 text-success-foreground text-xs">
                  <div className="size-1.5 rounded-full bg-success-solid" />
                  Connected
                </div>
              </div>
              <span
                className="min-w-0 self-start truncate font-normal text-subtle-foreground text-xs"
                dir="rtl"
              >
                <span dir="ltr">{currentWorkspacePath}</span>
              </span>
            </div>
          </div>
          {/* Recent workspaces list */}
          {otherRecentWorkspaces.length > 0 ? (
            <>
              <div className="my-1 h-px w-full bg-derived" />
              <OverlayScrollbar
                className="w-full"
                contentClassName="flex w-full flex-col items-start gap-0.5"
              >
                {otherRecentWorkspaces.map((workspace) => (
                  <RecentlyOpenedWorkspaceItem
                    key={workspace.path}
                    workspace={workspace}
                    onClick={() => openWorkspace(workspace.path)}
                  />
                ))}
              </OverlayScrollbar>
            </>
          ) : (
            <div className="flex w-full flex-1 items-center justify-center text-muted-foreground text-sm">
              No other recent workspaces
            </div>
          )}
        </div>
      </div>
    );
  }

  if (sortedRecentlyOpenedWorkspaces.length > 0) {
    return (
      <div className="flex w-full flex-col items-start gap-2">
        <div className="flex w-full items-center justify-between">
          <h1 className="flex items-center justify-center gap-2 font-medium text-foreground text-xl">
            Connect a workspace
            <Tooltip>
              <TooltipTrigger>
                <IconCircleQuestionOutline18 className="size-4 shrink-0 self-start text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <span>
                  Allows stagewise to read and modify files in your workspace.
                </span>
              </TooltipContent>
            </Tooltip>
          </h1>
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 text-xs"
            onClick={selectAndOpenWorkspace}
          >
            <IconFolder5OpenOutline18 className="size-4 shrink-0" />
            Open other
          </Button>
        </div>
        <div className="group/recent-workspaces flex w-full flex-1 flex-col items-start justify-start gap-1 rounded-lg border border-derived-strong bg-background p-3 shadow-[0_0_6px_0_rgba(0,0,0,0.05),0_-6px_48px_-24px_rgba(0,0,0,0.08)] dark:bg-surface-1">
          <div className="flex w-full flex-row items-start justify-between gap-14">
            <div className="flex w-full flex-col items-start gap-2">
              <div className="flex w-full flex-row items-start justify-between gap-1">
                <div className="shrink-0 font-medium text-muted-foreground text-xs">
                  Recent workspaces
                </div>
                {recentlyOpenedWorkspaces.length > 3 && (
                  <Button
                    variant={'ghost'}
                    size="sm"
                    className="hidden h-fit shrink-0 cursor-pointer items-center gap-1 p-0 text-xs group-hover/recent-workspaces:flex"
                    onClick={() =>
                      setShowAllRecentlyOpenedWorkspaces(
                        !showAllRecentlyOpenedWorkspaces,
                      )
                    }
                  >
                    Show all ({recentlyOpenedWorkspaces.length})
                    <IconChevronDownOutline18
                      className={cn(
                        'size-4 shrink-0',
                        showAllRecentlyOpenedWorkspaces
                          ? 'rotate-0'
                          : '-rotate-90',
                      )}
                    />
                  </Button>
                )}
              </div>
              <OverlayScrollbar
                className="max-h-60 w-full"
                contentClassName="flex w-full flex-col items-start gap-2"
              >
                {sortedRecentlyOpenedWorkspaces.map((workspace) => (
                  <RecentlyOpenedWorkspaceItem
                    key={workspace.path}
                    workspace={workspace}
                    onClick={() => {
                      openWorkspace(workspace.path);
                    }}
                  />
                ))}
              </OverlayScrollbar>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full items-center justify-between gap-4 rounded-lg border border-derived bg-linear-to-tr from-surface-1/70 to-surface-1/50 p-4 dark:from-base-750 dark:to-surface-1">
      <div className="flex items-center gap-3">
        <IconFolderFillDuo18 className="size-4 shrink-0 text-muted-foreground" />
        <span className="font-medium text-foreground text-sm">
          Connect a workspace to give the agent access to your project.
        </span>
      </div>
      <Button
        variant={'primary'}
        size="sm"
        className="shrink-0 rounded-lg"
        onClick={selectAndOpenWorkspace}
      >
        <IconFolder5OpenOutline18 className="size-4" />
        Connect workspace
      </Button>
    </div>
  );
}

function LocalPortsSection() {
  const openTab = useKartonProcedure((p) => p.openTab);
  const scanLocalPorts = useKartonProcedure((p) => p.scanLocalPorts);
  const localPorts = useKartonState((s) => s.homePage.localPorts);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await scanLocalPorts();
    } finally {
      setIsRefreshing(false);
    }
  }, [scanLocalPorts, isRefreshing]);

  // Refresh when the tab becomes visible
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void scanLocalPorts();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [scanLocalPorts]);

  const handlePortClick = useCallback(
    (url: string, event?: React.MouseEvent) => {
      const isModifierPressed = event?.metaKey || event?.ctrlKey;
      if (!isModifierPressed) window.location.href = url;
      else openTab(url, false);
    },
    [openTab],
  );

  return (
    <div className="flex w-full flex-col items-start gap-2">
      <div className="flex w-full items-center justify-between">
        <h1 className="font-medium text-foreground text-xl">Local Pages</h1>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleRefresh}
          aria-label="Refresh local ports"
        >
          <IconRefreshClockwiseOutline18
            className={cn(
              'size-4 text-muted-foreground',
              isRefreshing && 'animate-spin',
            )}
          />
        </Button>
      </div>
      <div className="flex w-full flex-1 flex-col items-start justify-start gap-0.5 rounded-lg border border-derived-strong bg-background p-2 shadow-[0_0_6px_0_rgba(0,0,0,0.05),0_-6px_48px_-24px_rgba(0,0,0,0.08)] dark:bg-surface-1">
        {localPorts.length === 0 ? (
          <div className="flex w-full flex-1 items-center justify-center text-muted-foreground text-sm">
            No local servers found
          </div>
        ) : (
          <OverlayScrollbar
            className="max-h-60 w-full"
            contentClassName="flex w-full flex-col items-start gap-0.5"
          >
            {localPorts.map((entry) => (
              <LocalPortItem
                key={entry.port}
                entry={entry}
                onClick={(event) => handlePortClick(entry.url, event)}
              />
            ))}
          </OverlayScrollbar>
        )}
      </div>
    </div>
  );
}

function LocalPortItem({
  entry,
  onClick,
}: {
  entry: LocalPortEntry;
  onClick: (event: React.MouseEvent) => void;
}) {
  return (
    <div
      className="flex w-full shrink-0 cursor-pointer items-center gap-2.5 rounded-md px-2 py-2.5 hover:bg-hover-derived"
      onClick={onClick}
    >
      <IconEarthFillDuo18 className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate font-normal text-foreground text-sm">
        localhost:{entry.port}
      </span>
    </div>
  );
}
