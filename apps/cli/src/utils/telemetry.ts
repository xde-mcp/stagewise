import { telemetryManager } from '../config/telemetry';

export { telemetryManager };

/**
 * Get the current telemetry level
 */
export async function getTelemetryLevel() {
  return telemetryManager.getLevel();
}

/**
 * Check if telemetry is enabled (not 'off')
 */
export async function isTelemetryEnabled() {
  const level = await telemetryManager.getLevel();
  return level !== 'off';
}

/**
 * Check if full telemetry is enabled
 */
export async function isFullTelemetryEnabled() {
  const level = await telemetryManager.getLevel();
  return level === 'full';
}