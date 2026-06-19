import { devices, type Project } from '@playwright/test';
import { fullMatrix } from './base-url.js';

/** Chromium-only on PRs; full matrix (all engines + mobile) when E2E_FULL=1. */
export function browserProjects(): Project[] {
  const base: Project[] = [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ];

  if (!fullMatrix()) return base;

  return [
    ...base,
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
    { name: 'mobile-safari', use: { ...devices['iPhone 15'] } },
  ];
}
