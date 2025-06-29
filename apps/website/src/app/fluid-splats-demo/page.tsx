'use client';

import { useRef, useState } from 'react';
import {
  FluidSplats,
  type FluidSplatsRef,
} from '@stagewise/ui/components/fluid-splats';

export default function FluidSplatsDemoPage() {
  const fluidRef = useRef<FluidSplatsRef>(null);
  const [config, setConfig] = useState({
    SPLAT_RADIUS: 0.25,
    SPLAT_FORCE: 6000,
    CURL: 30,
    PRESSURE: 0.8,
    DENSITY_DISSIPATION: 1,
    VELOCITY_DISSIPATION: 0.2,
  });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Trigger movement from previous position to current
    if (e.movementX !== 0 || e.movementY !== 0) {
      fluidRef.current?.triggerMove(x - e.movementX, y - e.movementY, x, y);
    }
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Create a splat at click position
    const dx = (Math.random() - 0.5) * 1000;
    const dy = (Math.random() - 0.5) * 1000;
    fluidRef.current?.splat(x, y, dx, dy);
  };

  return (
    <div className="relative h-screen w-full overflow-hidden bg-black">
      {/* Fluid Splats Canvas */}
      <FluidSplats
        ref={fluidRef}
        config={config}
        className="absolute inset-0 h-full w-full"
      />

      {/* Interactive Overlay */}
      <div
        className="absolute inset-0"
        onMouseMove={handleMouseMove}
        onClick={handleClick}
      />

      {/* Control Panel */}
      <div className="absolute top-4 left-4 max-w-sm space-y-4 rounded-lg bg-black/80 p-4 text-white backdrop-blur-sm">
        <h2 className="mb-4 font-bold text-xl">Fluid Splats Controls</h2>

        <div className="space-y-3">
          <div>
            <label htmlFor="splat-radius" className="text-sm opacity-80">
              Splat Radius
            </label>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.05"
              value={config.SPLAT_RADIUS}
              onChange={(e) =>
                setConfig({
                  ...config,
                  SPLAT_RADIUS: Number.parseFloat(e.target.value),
                })
              }
              className="w-full"
            />
            <span className="text-xs">{config.SPLAT_RADIUS.toFixed(2)}</span>
          </div>

          <div>
            <label htmlFor="splat-force" className="text-sm opacity-80">
              Splat Force
            </label>
            <input
              type="range"
              min="1000"
              max="10000"
              step="500"
              value={config.SPLAT_FORCE}
              onChange={(e) =>
                setConfig({
                  ...config,
                  SPLAT_FORCE: Number.parseInt(e.target.value),
                })
              }
              className="w-full"
            />
            <span className="text-xs">{config.SPLAT_FORCE}</span>
          </div>

          <div>
            <label htmlFor="curl" className="text-sm opacity-80">
              Vorticity (Curl)
            </label>
            <input
              type="range"
              min="0"
              max="50"
              step="1"
              value={config.CURL}
              onChange={(e) =>
                setConfig({ ...config, CURL: Number.parseInt(e.target.value) })
              }
              className="w-full"
            />
            <span className="text-xs">{config.CURL}</span>
          </div>

          <div>
            <label htmlFor="pressure" className="text-sm opacity-80">
              Pressure
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={config.PRESSURE}
              onChange={(e) =>
                setConfig({
                  ...config,
                  PRESSURE: Number.parseFloat(e.target.value),
                })
              }
              className="w-full"
            />
            <span className="text-xs">{config.PRESSURE.toFixed(1)}</span>
          </div>

          <div>
            <label htmlFor="density-dissipation" className="text-sm opacity-80">
              Density Dissipation
            </label>
            <input
              type="range"
              min="0"
              max="4"
              step="0.1"
              value={config.DENSITY_DISSIPATION}
              onChange={(e) =>
                setConfig({
                  ...config,
                  DENSITY_DISSIPATION: Number.parseFloat(e.target.value),
                })
              }
              className="w-full"
            />
            <span className="text-xs">
              {config.DENSITY_DISSIPATION.toFixed(1)}
            </span>
          </div>

          <div>
            <label
              htmlFor="velocity-dissipation"
              className="text-sm opacity-80"
            >
              Velocity Dissipation
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={config.VELOCITY_DISSIPATION}
              onChange={(e) =>
                setConfig({
                  ...config,
                  VELOCITY_DISSIPATION: Number.parseFloat(e.target.value),
                })
              }
              className="w-full"
            />
            <span className="text-xs">
              {config.VELOCITY_DISSIPATION.toFixed(2)}
            </span>
          </div>
        </div>

        <div className="border-white/20 border-t pt-4 text-sm opacity-80">
          <p>• Move mouse to create fluid motion</p>
          <p>• Click to create random splats</p>
        </div>
      </div>
    </div>
  );
}
