/// <reference types="vite/client" />

interface GodhandDesktopApi {
  isDesktop: boolean;
  browseFolder: () => Promise<string | null>;
}

interface Window {
  godhand?: GodhandDesktopApi;
}
