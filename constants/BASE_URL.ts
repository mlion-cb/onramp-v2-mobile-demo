const url = process.env.EXPO_PUBLIC_BASE_URL;
if (!url) {
  throw new Error('EXPO_PUBLIC_BASE_URL is not set');
}
export const BASE_URL = url;