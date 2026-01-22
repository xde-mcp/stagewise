import { Button } from '@stagewise/stage-ui/components/button';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@stagewise/stage-ui/components/tooltip';
import { cn } from '@stagewise/stage-ui/lib/utils';
import type { DragHandleProps } from './types';

export type ToggleButtonProps = {
  ariaLabel: string;
  icon: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  tooltipContent?: string | React.ReactNode;
  dragHandleProps?: DragHandleProps;
  isDragging?: boolean;
  triggerClassName?: string;
};

export function ToggleButton(props: ToggleButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger delay={10} closeDelay={10}>
        <Button
          variant="ghost"
          size="icon-md"
          aria-label={props.ariaLabel}
          className={cn(
            'shrink-0',
            props.active
              ? 'text-primary-foreground hover:text-primary-foreground!'
              : 'text-foreground',
            props.isDragging && 'cursor-grabbing',
            props.triggerClassName,
          )}
          onClick={props.onClick}
          disabled={props.disabled}
          {...props.dragHandleProps?.attributes}
          {...props.dragHandleProps?.listeners}
        >
          {props.icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left" sideOffset={0}>
        {props.tooltipContent ?? props.ariaLabel}
      </TooltipContent>
    </Tooltip>
  );
}
