import { Panel, Button, useToolbar } from '@stagewise/toolbar/plugin-ui';

export const ExampleComponent = () => {
  const toolbar = useToolbar();

  return (
    <Panel>
      <Panel.Header title="React Plugin" />
      <Panel.Content>
        <Button
          style="ghost"
          onClick={() => toolbar.sendPrompt('Hello world!')}
        >
          REACT PLUGIN LOL
        </Button>
      </Panel.Content>
    </Panel>
  );
};
