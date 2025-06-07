import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { StagewiseToolbar } from '@stagewise/toolbar-next';
import { ReactPlugin } from '@stagewise-plugins/react';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <StagewiseToolbar config={{ plugins: [ReactPlugin] }} />
      <Component {...pageProps} />
    </>
  );
}
