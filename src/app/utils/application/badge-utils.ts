// shared/utils/badge-utils.ts
import {
  BadgeConfig,
  IconConfig,
} from '../../interfaces/Application/application.interface';

// Badge Styles Configuration
export const BADGE_STYLES = {
  // All Application statuses
  New: ['tw-bg-green-500', 'tw-text-white', 'tw-ring-green-500/10'],
  'Over 3 Day': ['tw-bg-yellow-400', 'tw-text-black', 'tw-ring-yellow-500/10'],
  'Over Week': ['tw-bg-red-500', 'tw-text-white', 'tw-ring-red-500/10'],
  'Over Month': ['tw-bg-red-900', 'tw-text-white', 'tw-ring-red-900/10'],

  // Screening statuses
  Accepted: ['bg-mint', 'tw-text-green-600', 'tw-ring-green-600/10'],
  'On Hold': ['bg-yellow', 'tw-text-green-600', 'tw-ring-yellow-500/10'],
  Declined: ['tw-bg-red-500', 'tw-text-white', 'tw-ring-red-500/10'],
  Pending: ['tw-bg-blue-500', 'tw-text-white', 'tw-ring-blue-500/10'],

  // Interview Form Tracking statuses
  "Pass Interview": ['tw-bg-green-500', 'tw-text-white', 'tw-ring-green-500/10'],

  // Default
  default: ['tw-bg-gray-50', 'tw-text-gray-600', 'tw-ring-gray-500/10'],
} as const;

export type BadgeStyleKey = keyof typeof BADGE_STYLES;

/**
 * Creates a badge configuration with appropriate styling
 */
export function createStatusBadge(statusLabel: string): BadgeConfig {
  const styles =
    BADGE_STYLES[statusLabel as BadgeStyleKey] || BADGE_STYLES.default;

  return {
    label: statusLabel,
    class: styles,
  };
}

/**
 * Creates a qualified icon configuration
 */
export function createQualifiedIcon(qualified: number): IconConfig {
  return qualified === 1
    ? { icon: 'check-circle', fill: 'green', size: '25' }
    : { icon: 'xmark-circle', fill: 'red', size: '25' };
}

/**
 * Generic badge creator for custom statuses
 */
export function createCustomBadge(
  label: string,
  type: 'success' | 'warning' | 'danger' | 'info' | 'default' = 'default'
): BadgeConfig {
  const typeStyles = {
    success: ['tw-bg-green-500', 'tw-text-white', 'tw-ring-green-500/10'],
    warning: ['tw-bg-yellow-400', 'tw-text-black', 'tw-ring-yellow-500/10'],
    danger: ['tw-bg-red-500', 'tw-text-white', 'tw-ring-red-500/10'],
    info: ['tw-bg-blue-500', 'tw-text-white', 'tw-ring-blue-500/10'],
    default: ['tw-bg-gray-50', 'tw-text-gray-600', 'tw-ring-gray-500/10'],
  };

  return {
    label,
    class: typeStyles[type],
  };
}
