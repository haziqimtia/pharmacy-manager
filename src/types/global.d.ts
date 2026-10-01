import type { PharmacyApi } from '../../electron/shared/api-types';

declare global {
  interface Window {
    api: PharmacyApi;
  }
}

export {};
