import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/_internal-app/agent-settings')({
  component: () => <Outlet />,
});
