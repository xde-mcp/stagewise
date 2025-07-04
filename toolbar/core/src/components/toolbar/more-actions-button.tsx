import { Ellipsis, Minimize2 } from 'lucide-react';
import {
  DropdownMenuButton,
  DropdownMenuButtonItem,
  DropdownMenuContent,
} from '../ui/dropdown-menu';
import { DropdownMenu } from '../ui/dropdown-menu';
import { ToolbarButton } from './button';
import { useAppState } from '@/hooks/use-app-state';
import { ToolbarSection } from './section';

export function ToolbarMoreActionsButton() {
  const { minimize } = useAppState();

  return (
    <ToolbarSection>
      <DropdownMenu>
        <DropdownMenuButton>
          <ToolbarButton>
            <Ellipsis className="size-4" />
          </ToolbarButton>
        </DropdownMenuButton>
        <DropdownMenuContent>
          <DropdownMenuButtonItem onClick={() => minimize()}>
            <Minimize2 className="size-4" />
            Minimize companion
          </DropdownMenuButtonItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </ToolbarSection>
  );
}
