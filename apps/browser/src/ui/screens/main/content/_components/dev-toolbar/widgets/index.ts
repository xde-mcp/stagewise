import { ConsoleWidget } from './console';
import { DomInspectorWidget } from './dom-inspector';
import { ColorSchemeWidget } from './color-scheme';
import { DeviceEmulationWidget } from './device-emulation';
import { ColorToolsWidget } from './color-tools';
import { FontToolsWidget } from './font-tools';
import { PerformanceToolsWidget } from './performance-tools';
import { AccessibilityToolsWidget } from './accessibility-tools';
import { ImageGenerationToolsWidget } from './image-generation-tools';
import { NetworkToolsWidget } from './network-tools';
import { ChromeDevToolsWidget } from './chrome-devtools';
import type { WidgetId, WidgetComponent } from './types';

export const widgetRegistry: Record<WidgetId, WidgetComponent> = {
  console: ConsoleWidget,
  'dom-inspector': DomInspectorWidget,
  'color-scheme': ColorSchemeWidget,
  'device-emulation': DeviceEmulationWidget,
  'color-tools': ColorToolsWidget,
  'font-tools': FontToolsWidget,
  'performance-tools': PerformanceToolsWidget,
  'accessibility-tools': AccessibilityToolsWidget,
  'image-generation-tools': ImageGenerationToolsWidget,
  'network-tools': NetworkToolsWidget,
  'chrome-devtools': ChromeDevToolsWidget,
};

export type { WidgetId, WidgetProps, WidgetComponent } from './types';
