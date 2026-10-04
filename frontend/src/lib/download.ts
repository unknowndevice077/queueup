import { api } from './api';

/** Downloads an authenticated file (e.g. the CSV export) by fetching it as a blob. */
export async function downloadFile(path: string, fallbackName: string): Promise<void> {
  const response = await api.raw(path);
  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const match = /filename="?([^";]+)"?/.exec(disposition);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = match?.[1] ?? fallbackName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
