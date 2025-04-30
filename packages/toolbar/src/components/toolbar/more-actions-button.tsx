import { Ellipsis, Minimize2 } from "lucide-react";
import {
  DropdownMenuButton,
  DropdownMenuButttonItem,
  DropdownMenuContent,
} from "../ui/dropdown-menu";
import { DropdownMenu } from "../ui/dropdown-menu";
import { ToolbarButton } from "./button";
import { useAppState } from "@/hooks/use-app-state";
import { ToolbarSection } from "./section";
import { usePlugins } from "@/hooks/use-plugins";
import { useMemo } from "preact/hooks";
export function MoreActionsButton() {
  const minimizeCompanion = useAppState((state) => state.minimize);

  const plugins = usePlugins();

  const pluginTools = useMemo(() => {
    return plugins.flatMap((plugin) => plugin.actions);
  }, [plugins]);

  console.log("pluginTools", pluginTools);

  return (
    <ToolbarSection>
      <DropdownMenu>
        <DropdownMenuButton>
          <ToolbarButton>
            <Ellipsis className="size-4" />
          </ToolbarButton>
        </DropdownMenuButton>
        <DropdownMenuContent>
          {pluginTools.map((tool) => (
            <DropdownMenuButttonItem onClick={tool.execute}>
              {tool.name}
            </DropdownMenuButttonItem>
          ))}
          <DropdownMenuButttonItem onClick={minimizeCompanion}>
            <Minimize2 className="size-4" />
            Minimize companion
          </DropdownMenuButttonItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </ToolbarSection>
  );
}
