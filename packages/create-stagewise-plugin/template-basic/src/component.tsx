import { Panel, Button, useToolbar } from '@stagewise/toolbar/plugin-ui';

export const ExampleComponent = () => {
  const toolbar = useToolbar();

  return (
    <Panel>
      <Panel.Header title="Example Plugin" />
      <Panel.Content>
        <Button onClick={() => toolbar.sendPrompt('Hello from plugin!')}>
          Open Example Panel
        </Button>
      </Panel.Content>
    </Panel>
  );
};
