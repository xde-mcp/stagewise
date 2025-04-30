import { ChatStateProvider } from "@/hooks/use-chat-state";
import { LocationProvider } from "../hooks/use-location";
import { type ComponentChildren } from "preact";
import { PluginProvider } from "@/hooks/use-plugins";
import { ToolbarConfig } from "../config";

export function ContextProviders({
  children,
  config,
}: {
  children?: ComponentChildren;
  config: ToolbarConfig;
}) {
  console.log("ContextProviders rendered!");
  return (
    <LocationProvider>
      <PluginProvider plugins={config.plugins}>
        <ChatStateProvider>{children}</ChatStateProvider>
      </PluginProvider>
    </LocationProvider>
  );
}
