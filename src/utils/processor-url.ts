export function requireProcessorBaseUrl(value: string | undefined): string {
  try {
    const url = new URL(value || '');
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('Unsupported protocol');
    }
    return String(value).replace(/\/+$/, '');
  } catch {
    throw Object.assign(new Error('PROCESSOR_API_URL must be configured as an absolute HTTP or HTTPS URL.'), {
      status: 503, code: 'PROCESSOR_API_NOT_CONFIGURED'
    });
  }
}
