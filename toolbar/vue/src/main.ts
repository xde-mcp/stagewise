import { createApp } from 'vue';
import StagewiseToolbar from './StagewiseToolbar.vue';
import type { ToolbarConfig } from '@stagewise/toolbar';

// Example App component (can be inlined or a separate .vue file)
const App = {
  components: { StagewiseToolbar },
  setup() {
    const toolbarConfig: ToolbarConfig = {
      plugins: [],
    };
    return { toolbarConfig };
  },
  template: '<StagewiseToolbar :config="toolbarConfig" />',
};

createApp(App).mount('#app');
