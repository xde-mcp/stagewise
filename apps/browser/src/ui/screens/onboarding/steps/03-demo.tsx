import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AgentIdeIntegrationDark,
  AgentIdeIntegrationLight,
  DebuggerAccessDark,
  DebuggerAccessLight,
  ExperimentsDark,
  ExperimentsLight,
  ReverseEngineeringDark,
  ReverseEngineeringLight,
} from '@/assets/feature-images';
import { cn } from '@/utils';
import { IconArrowLeftFill18, IconArrowRightFill18 } from 'nucleo-ui-fill-18';

interface Slide {
  heading: string;
  subtitle: string;
  light: string;
  dark: string;
}

const slides: Slide[] = [
  {
    heading: 'Reverse-engineer any site',
    subtitle:
      'Understand the styles, layout, and functionality of any website.',
    light: ReverseEngineeringLight,
    dark: ReverseEngineeringDark,
  },
  {
    heading: 'An agent with full access to devtools',
    subtitle: 'Console logs, network requests, performance analysis, and more.',
    light: DebuggerAccessLight,
    dark: DebuggerAccessDark,
  },
  {
    heading: 'Run quick experiments',
    subtitle: 'Make temporary changes to any page, right inside the DOM.',
    light: ExperimentsLight,
    dark: ExperimentsDark,
  },
  {
    heading: 'Connected to your codebase',
    subtitle:
      'Linting support, agent skills, context files, version history, and more.',
    light: AgentIdeIntegrationLight,
    dark: AgentIdeIntegrationDark,
  },
];

const SLIDE_INTERVAL = 4500;
const FADE_DURATION = 200;

export function StepDemo() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [slideKey, setSlideKey] = useState(0);
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fadeRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (fadeRef.current) clearTimeout(fadeRef.current);
    timerRef.current = null;
    fadeRef.current = null;
  }, []);

  const advance = useCallback(() => {
    clearTimers();
    setVisible(false);
    fadeRef.current = setTimeout(() => {
      fadeRef.current = null;
      setActiveIndex((prev) => (prev + 1) % slides.length);
      setSlideKey((k) => k + 1);
      setVisible(true);
      timerRef.current = setInterval(advance, SLIDE_INTERVAL);
    }, FADE_DURATION);
  }, [clearTimers]);

  const retreat = useCallback(() => {
    clearTimers();
    setVisible(false);
    fadeRef.current = setTimeout(() => {
      fadeRef.current = null;
      setActiveIndex((prev) => (prev - 1 + slides.length) % slides.length);
      setSlideKey((k) => k + 1);
      setVisible(true);
      timerRef.current = setInterval(advance, SLIDE_INTERVAL);
    }, FADE_DURATION);
  }, [advance, clearTimers]);

  useEffect(() => {
    timerRef.current = setInterval(advance, SLIDE_INTERVAL);
    return clearTimers;
  }, [advance, clearTimers]);

  const slide = slides[activeIndex];

  return (
    <div className="flex flex-1 items-center justify-center gap-0">
      <div
        className={cn(
          'flex w-fit flex-col items-center gap-4 transition-opacity',
          visible ? 'opacity-100' : 'opacity-0',
        )}
        style={{ transitionDuration: `${FADE_DURATION}ms` }}
      >
        <h1 className="font-semibold text-2xl text-foreground">
          {slide.heading}
        </h1>
        <p className="text-muted-foreground text-sm">{slide.subtitle}</p>
        <SlideIndicators
          itemsAmount={slides.length}
          activeIndex={activeIndex}
          slideKey={slideKey}
          animationDuration={SLIDE_INTERVAL}
        />
        <div className="relative flex w-1/2 items-center">
          {/* Left hover zone — extends over left half of image, icon sits outside */}
          <button
            type="button"
            onClick={retreat}
            className="group/prev app-no-drag -left-8 absolute top-0 bottom-0 z-10 flex w-[calc(50%+2rem)] cursor-pointer items-center"
          >
            <IconArrowLeftFill18 className="size-5 text-foreground opacity-0 transition-opacity group-hover/prev:opacity-80" />
          </button>

          <img
            src={slide.light}
            alt={slide.heading}
            className="block h-auto w-full rounded-md border border-border-subtle dark:hidden"
          />
          <img
            src={slide.dark}
            alt={slide.heading}
            className="hidden h-auto w-full rounded-md border border-border-subtle dark:block"
          />

          {/* Right hover zone — extends over right half of image, icon sits outside */}
          <button
            type="button"
            onClick={advance}
            className="group/next app-no-drag -right-8 absolute top-0 bottom-0 z-10 flex w-[calc(50%+2rem)] cursor-pointer items-center justify-end"
          >
            <IconArrowRightFill18 className="size-5 text-foreground opacity-0 transition-opacity group-hover/next:opacity-80" />
          </button>
        </div>
      </div>
    </div>
  );
}

function SlideIndicators({
  itemsAmount,
  activeIndex,
  slideKey,
  animationDuration,
}: {
  itemsAmount: number;
  activeIndex: number;
  slideKey: number;
  animationDuration: number;
}) {
  return (
    <div className="flex flex-row items-center justify-center gap-2">
      <style>
        {`@keyframes indicator-fill {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }`}
      </style>
      {Array.from({ length: itemsAmount }).map((_, index) => {
        const isPast = index < activeIndex;
        const isCurrent = index === activeIndex;
        return (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: Items won't change
            key={`slide-indicator-${index}`}
            className={cn(
              'relative h-1 w-8 overflow-hidden rounded-full',
              'bg-background/l-4_c-2 dark:bg-background/l12_cx0.9',
            )}
          >
            {(isPast || isCurrent) && (
              <div
                key={isCurrent ? slideKey : undefined}
                className="absolute inset-0 bg-background/l-12_c-2 will-change-transform dark:bg-background/l22_cx0.9"
                style={
                  isCurrent
                    ? {
                        transformOrigin: 'left',
                        animation: `indicator-fill ${animationDuration}ms linear forwards`,
                      }
                    : undefined
                }
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
