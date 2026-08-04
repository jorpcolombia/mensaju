/**
 * Single source of truth for the product's display name.
 * Swap this (and APP_NAME/NEXT_PUBLIC_APP_NAME env vars in each app) to rename
 * the product without touching business logic elsewhere.
 */
export const APP_NAME = process.env.APP_NAME ?? "Messages";
