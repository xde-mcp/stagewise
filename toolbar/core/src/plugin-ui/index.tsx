import { usePlugins } from '@/hooks/use-plugins';

export {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'preact/hooks';

export * from 'preact';

export const useToolbar = () => {
  const plugins = usePlugins();

  return plugins.toolbarContext;
};

export {
  PluginBox,
  PluginBoxHeader,
  PluginBoxContent,
  PluginBoxFooter,
} from '@/plugin-ui/components/plugin-box';
