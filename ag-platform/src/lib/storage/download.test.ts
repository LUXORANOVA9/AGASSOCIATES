import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSignedUrl } from './download.ts';

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    storage: {
      from: (bucket: string) => globalThis.mockFrom(bucket)
    }
  })
}));

describe('getSignedUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.mockCreateSignedUrl = vi.fn();
    globalThis.mockFrom = vi.fn(() => ({
      createSignedUrl: globalThis.mockCreateSignedUrl
    }));
  });

  it('generates a signed URL with default expiry', async () => {
    globalThis.mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://example.com/signed-url' },
      error: null
    });

    const url = await getSignedUrl('my-bucket', 'path/to/file.txt');

    expect(url).toBe('https://example.com/signed-url');
    expect(globalThis.mockFrom).toHaveBeenCalledWith('my-bucket');
    expect(globalThis.mockCreateSignedUrl).toHaveBeenCalledWith('path/to/file.txt', 3600);
  });

  it('generates a signed URL with custom expiry', async () => {
    globalThis.mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://example.com/signed-url-custom' },
      error: null
    });

    const url = await getSignedUrl('my-bucket', 'path/to/file.txt', 7200);

    expect(url).toBe('https://example.com/signed-url-custom');
    expect(globalThis.mockFrom).toHaveBeenCalledWith('my-bucket');
    expect(globalThis.mockCreateSignedUrl).toHaveBeenCalledWith('path/to/file.txt', 7200);
  });

  it('throws an error if Supabase returns an error', async () => {
    globalThis.mockCreateSignedUrl.mockResolvedValue({
      data: null,
      error: { message: 'Storage error' }
    });

    await expect(getSignedUrl('my-bucket', 'path/to/file.txt'))
      .rejects.toThrow('Failed to generate signed URL: Storage error');
  });

  it('throws an error if data.signedUrl is missing', async () => {
    globalThis.mockCreateSignedUrl.mockResolvedValue({
      data: {},
      error: null
    });

    await expect(getSignedUrl('my-bucket', 'path/to/file.txt'))
      .rejects.toThrow('Failed to generate signed URL: undefined');
  });
});

declare global {
  var mockFrom: any;
  var mockCreateSignedUrl: any;
}
