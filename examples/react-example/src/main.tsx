import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { StagewiseToolbar } from '@stagewise/toolbar-react';

// Render the main app
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Initialize toolbar separately so it doesn't block the main UI
// This allows the toolbar to be always active without interfering with the app
const toolbarConfig = {
  plugins: [],
};

// Add the toolbar outside the main React tree
document.addEventListener('DOMContentLoaded', () => {
  const toolbarRoot = document.createElement('div');
  toolbarRoot.id = 'toolbar-root';
  document.body.appendChild(toolbarRoot);

  createRoot(toolbarRoot).render(<StagewiseToolbar config={toolbarConfig} />);
});
