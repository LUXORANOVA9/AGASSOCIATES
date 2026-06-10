import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getSignedUrl, downloadFile } from './download.ts';

const mockCreateSignedUrl = vi.fn();
const mockDownload = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    storage: {
      from: vi.fn(() => ({
        createSignedUrl: mockCreateSignedUrl,
        download: mockDownload
      }))
    }
  })
}));

describe('getSignedUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a signed URL when successful', async () => {
    mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://example.com/signed-url' },
      error: null
    });

    const url = await getSignedUrl('my-bucket', 'path/to/file.txt');
    expect(url).toBe('https://example.com/signed-url');
    expect(mockCreateSignedUrl).toHaveBeenCalledWith('path/to/file.txt', 3600);
  });

  it('throws an error when Supabase returns an error', async () => {
    mockCreateSignedUrl.mockResolvedValue({
      data: null,
      error: { message: 'Supabase error message' }
    });

    await expect(getSignedUrl('my-bucket', 'path/to/file.txt')).rejects.toThrow('Failed to generate signed URL: Supabase error message');
  });

  it('throws an error when data does not contain signedUrl', async () => {
    mockCreateSignedUrl.mockResolvedValue({
      data: {},
      error: null
    });

    await expect(getSignedUrl('my-bucket', 'path/to/file.txt')).rejects.toThrow('Failed to generate signed URL: undefined');
  });
});

describe('downloadFile', () => {
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  // Mock global document
  const mockAnchor = {
    href: '',
    download: '',
    click: vi.fn(),
  };

  const mockDocument = {
    createElement: vi.fn().mockImplementation((tagName: string) => {
      if (tagName === 'a') return mockAnchor;
      return {};
    }),
    body: {
      appendChild: vi.fn(),
      removeChild: vi.fn()
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // We are running in Node environment (vitest defaults or specific environment),
    // we need to set global URL and document explicitly if they don't exist
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:https://example.com/test-blob-url');
    globalThis.URL.revokeObjectURL = vi.fn();

    globalThis.document = mockDocument as any;
  });

  afterEach(() => {
    globalThis.URL.createObjectURL = originalCreateObjectURL;
    globalThis.URL.revokeObjectURL = originalRevokeObjectURL;
    delete (globalThis as any).document;
  });

  it('downloads a file when successful', async () => {
    const mockBlob = new Blob(['test content'], { type: 'text/plain' });
    mockDownload.mockResolvedValue({
      data: mockBlob,
      error: null
    });

    await downloadFile('my-bucket', 'path/to/file.txt', 'downloaded-file.txt');

    expect(mockDownload).toHaveBeenCalledWith('path/to/file.txt');
    expect(globalThis.URL.createObjectURL).toHaveBeenCalledWith(mockBlob);

    // Verify DOM manipulations happened
    expect(mockDocument.createElement).toHaveBeenCalledWith('a');
    expect(mockDocument.body.appendChild).toHaveBeenCalled();
    expect(mockAnchor.click).toHaveBeenCalled();
    expect(mockDocument.body.removeChild).toHaveBeenCalled();
    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith('blob:https://example.com/test-blob-url');
  });

  it('throws an error when Supabase returns an error', async () => {
    mockDownload.mockResolvedValue({
      data: null,
      error: { message: 'Download failed message' }
    });

    await expect(downloadFile('my-bucket', 'path/to/file.txt', 'file.txt')).rejects.toThrow('Download failed: Download failed message');
  });

  it('throws an error when data is empty', async () => {
    mockDownload.mockResolvedValue({
      data: null,
      error: null
    });

    await expect(downloadFile('my-bucket', 'path/to/file.txt', 'file.txt')).rejects.toThrow('Download failed: undefined');
  });
});
