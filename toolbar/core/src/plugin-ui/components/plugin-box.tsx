import type { ComponentChildren } from 'preact';

export function PluginBox({ children }: { children: ComponentChildren }) {
  return (
    <div className="flex max-h-[70vh] min-h-48 w-auto flex-col items-stretch justify-center gap-4 rounded-2xl border border-border/30 bg-white/80 p-4 backdrop-blur-md">
      {children}
    </div>
  );
}

export function PluginBoxHeader({
  title,
  description,
}: { title?: string; description?: string }) {
  return (
    <div className="flex flex-col gap-1">
      {title && (
        <h3 className="font-semibold text-lg text-zinc-950 ">{title}</h3>
      )}
      {description && (
        <p className="font-medium text-zinc-600">{description}</p>
      )}
    </div>
  );
}

export function PluginBoxContent({
  children,
}: { children: ComponentChildren }) {
  return (
    <div className="flex flex-1 flex-col items-stretch gap-2 overflow-y-auto text-zinc-950">
      {children}
    </div>
  );
}

export function PluginBoxFooter({ children }: { children: ComponentChildren }) {
  return (
    <div className="flex flex-row items-end justify-end gap-2 text-sm text-zinc-600">
      {children}
    </div>
  );
}
