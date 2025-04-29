"use client";

import { useEffect, useRef } from "react";
import { initToolbar } from "@stagewise/toolbar";

export default function ToolbarWrapper() {
  const isLoaded = useRef(false);
  useEffect(() => {
    if (isLoaded.current) return;
    isLoaded.current = true;
    initToolbar({ plugins: [] });
  }, []);
  return null;
}
