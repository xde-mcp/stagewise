"use client";

import { useEffect, useRef } from "react";
import { initToolbar, type ToolbarConfig } from "@stagewise/toolbar";
export { type ToolbarConfig };

export default function ToolbarWrapper({ config }: { config: ToolbarConfig }) {
  const isLoaded = useRef(false);
  useEffect(() => {
    if (isLoaded.current) return;
    isLoaded.current = true;
    initToolbar(config);
  }, []);
  return null;
}
