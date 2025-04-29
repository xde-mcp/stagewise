"use client";

import dynamic from "next/dynamic";

const ToolbarWrapper = dynamic(() => import("./toolbar-wrapper"), {
  ssr: false,
});

export default function ToolbarLoader() {
  return <ToolbarWrapper />;
}
