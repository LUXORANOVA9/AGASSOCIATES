import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getSignedUrl, downloadFile } from './download.ts';

// Mock Supabase client
const mockCreateSignedUrl = vi.fn();
const mockDownload = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    storage: {
      from: vi.fn(() => ({
        createSignedUrl: mockCreateSignedUrl,
        download: mockDownload,
      }))
    }
  })
}));

describe('download module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSignedUrl', () => {
    it('returns signedUrl on success', async () => {
      mockCreateSignedUrl.mockResolvedValue({
        data: { signedUrl: 'https://example.com/signed-url' },
        error: null,
      });

      const result = await getSignedUrl('my-bucket', 'path/to/file.txt');
      expect(result).toBe('https://example.com/signed-url');
      expect(mockCreateSignedUrl).toHaveBeenCalledWith('path/to/file.txt', 3600);
    });

    it('uses custom expiresInSeconds', async () => {
      mockCreateSignedUrl.mockResolvedValue({
        data: { signedUrl: 'https://example.com/signed-url' },
        error: null,
      });

      await getSignedUrl('my-bucket', 'path/to/file.txt', 7200);
      expect(mockCreateSignedUrl).toHaveBeenCalledWith('path/to/file.txt', 7200);
    });

    it('throws error when createSignedUrl returns an error', async () => {
      mockCreateSignedUrl.mockResolvedValue({
        data: null,
        error: { message: 'Some Supabase error' },
      });

      await expect(getSignedUrl('my-bucket', 'path/to/file.txt'))
        .rejects.toThrow('Failed to generate signed URL: Some Supabase error');
    });

    it('throws error when signedUrl is missing from data', async () => {
      mockCreateSignedUrl.mockResolvedValue({
        data: {}, // No signedUrl
        error: null,
      });

      await expect(getSignedUrl('my-bucket', 'path/to/file.txt'))
        .rejects.toThrow('Failed to generate signed URL: undefined');
    });
  });

  describe('downloadFile', () => {
    let originalURL: any;
    let originalDocument: any;

    beforeEach(() => {
      // Setup browser mocks
      originalURL = global.URL;
      originalDocument = global.document;

      global.URL = {
        createObjectURL: vi.fn().mockReturnValue('blob:mock-url'),
        revokeObjectURL: vi.fn(),
      } as any;

      const mockAnchor = {
        href: '',
        download: '',
        click: vi.fn(),
      };

      global.document = {
        createElement: vi.fn().mockReturnValue(mockAnchor),
        body: {
          appendChild: vi.fn(),
          removeChild: vi.fn(),
        },
      } as any;
    });

    afterEach(() => {
      global.URL = originalURL;
      global.document = originalDocument;
    });

    it('downloads file successfully', async () => {
      const mockBlob = new Blob(['test content']);
      mockDownload.mockResolvedValue({
        data: mockBlob,
        error: null,
      });

      await downloadFile('my-bucket', 'path/to/file.txt', 'downloaded-file.txt');

      expect(mockDownload).toHaveBeenCalledWith('path/to/file.txt');
      expect(global.URL.createObjectURL).toHaveBeenCalledWith(mockBlob);
      expect(global.document.createElement).toHaveBeenCalledWith('a');

      const mockAnchor = (global.document.createElement as any).mock.results[0].value;
      expect(mockAnchor.href).toBe('blob:mock-url');
      expect(mockAnchor.download).toBe('downloaded-file.txt');
      expect(global.document.body.appendChild).toHaveBeenCalledWith(mockAnchor);
      expect(mockAnchor.click).toHaveBeenCalled();
      expect(global.document.body.removeChild).toHaveBeenCalledWith(mockAnchor);
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });

    it('throws error when download returns an error', async () => {
      mockDownload.mockResolvedValue({
        data: null,
        error: { message: 'Download failed message' },
      });

      await expect(downloadFile('my-bucket', 'path/to/file.txt', 'file.txt'))
        .rejects.toThrow('Download failed: Download failed message');
    });

    it('throws error when data is missing', async () => {
      mockDownload.mockResolvedValue({
        data: null,
        error: null,
      });

      await expect(downloadFile('my-bucket', 'path/to/file.txt', 'file.txt'))
        .rejects.toThrow('Download failed: undefined');
    });
  });
});
