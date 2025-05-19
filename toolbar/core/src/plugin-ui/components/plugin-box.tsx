import type { ComponentChildren } from 'preact';

export function PluginBox({ children }: { children: ComponentChildren }) {
  return (
    <div className="flex max-h-auto min-h-48 w-auto items-center justify-center gap-4 overflow-y-auto rounded-2xl border border-border/30 bg-white/80 p-4 backdrop-blur-md">
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
      {title && <h3 className="font-semibold text-lg ">{title}</h3>}
      {description && (
        <p className="font-medium text-gray-500 text-sm">{description}</p>
      )}
    </div>
  );
}

export function PluginBoxContent({
  children,
}: { children: ComponentChildren }) {
  return <div className="flex flex-1 flex-col gap-2">{children}</div>;
}

export function PluginBoxFooter({ children }: { children: ComponentChildren }) {
  return (
    <div className="flex flex-row items-end justify-end gap-2">{children}</div>
  );
}
