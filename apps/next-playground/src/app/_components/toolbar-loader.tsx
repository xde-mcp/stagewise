"use client";

import dynamic from "next/dynamic";
import { type ToolbarConfig } from "./toolbar-wrapper";
export { type ToolbarConfig };

const ToolbarWrapper = dynamic(() => import("./toolbar-wrapper"), {
  ssr: false,
});

const stagewiseConfig: ToolbarConfig = {
  plugins: [
    {
      name: "react",
      description: "Adds context for React components",
      mcp: null,
      shortInfoForPrompt: (msg) => {
        return "The selected component is a React component. It's called 'blablub'. It's inside XY.";
      },
      actions: [
        {
          name: "Show alert",
          description:
            "Shows an alert with the message 'Ich bin eine custom action!'",
          execute: () => {
            window.alert("Ich bin eine custom action!");
          },
        },
      ],
    },
  ],
};

export function ToolbarLoader() {
  return <ToolbarWrapper config={stagewiseConfig} />;
}
