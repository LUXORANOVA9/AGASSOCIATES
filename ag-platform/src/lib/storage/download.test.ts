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

// Mock DOM APIs
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;
const mockCreateObjectURL = vi.fn();
const mockRevokeObjectURL = vi.fn();
const mockAppendChild = vi.fn();
const mockRemoveChild = vi.fn();

describe('download.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup URL mocks
    URL.createObjectURL = mockCreateObjectURL;
    URL.revokeObjectURL = mockRevokeObjectURL;
    mockCreateObjectURL.mockReturnValue('blob:mock-url');

    // Setup DOM mocks
    // Note: Since Vitest might be running in Node environment by default without jsdom,
    // we need to mock document globally
    if (typeof global.document === 'undefined') {
      (global as any).document = {
        createElement: vi.fn(),
        body: {
          appendChild: mockAppendChild,
          removeChild: mockRemoveChild,
        }
      };
    } else {
      vi.spyOn(document.body, 'appendChild').mockImplementation(mockAppendChild as any);
      vi.spyOn(document.body, 'removeChild').mockImplementation(mockRemoveChild as any);
    }
  });

  afterEach(() => {
    // Restore URL mocks
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;

    if (typeof global.document !== 'undefined') {
      vi.restoreAllMocks();
    }
  });

  describe('getSignedUrl', () => {
    it('successfully generates a signed URL', async () => {
      mockCreateSignedUrl.mockResolvedValue({
        data: { signedUrl: 'https://example.com/signed-url' },
        error: null
      });

      const url = await getSignedUrl('my-bucket', 'path/to/file.txt');

      expect(url).toBe('https://example.com/signed-url');
      expect(mockCreateSignedUrl).toHaveBeenCalledWith('path/to/file.txt', 3600);
    });

    it('throws error when supabase returns an error', async () => {
      mockCreateSignedUrl.mockResolvedValue({
        data: null,
        error: { message: 'Storage error' }
      });

      await expect(getSignedUrl('my-bucket', 'path/to/file.txt')).rejects.toThrow('Failed to generate signed URL: Storage error');
    });

    it('throws error when signedUrl is missing', async () => {
      mockCreateSignedUrl.mockResolvedValue({
        data: {}, // Missing signedUrl
        error: null
      });

      await expect(getSignedUrl('my-bucket', 'path/to/file.txt')).rejects.toThrow('Failed to generate signed URL: undefined');
    });
  });

  describe('downloadFile', () => {
    it('successfully downloads a file', async () => {
      const mockBlob = new Blob(['test content'], { type: 'text/plain' });
      mockDownload.mockResolvedValue({
        data: mockBlob,
        error: null
      });

      const mockAnchorElement = {
        href: '',
        download: '',
        click: vi.fn(),
      };

      const mockCreateElement = vi.fn().mockReturnValue(mockAnchorElement);
      if (typeof global.document !== 'undefined') {
        vi.spyOn(document, 'createElement').mockImplementation(mockCreateElement as any);
      } else {
        (global as any).document.createElement = mockCreateElement;
      }

      await downloadFile('my-bucket', 'path/to/file.txt', 'downloaded-file.txt');

      expect(mockDownload).toHaveBeenCalledWith('path/to/file.txt');
      expect(mockCreateObjectURL).toHaveBeenCalledWith(mockBlob);
      expect(mockCreateElement).toHaveBeenCalledWith('a');

      // Verify anchor properties
      expect(mockAnchorElement.href).toBe('blob:mock-url');
      expect(mockAnchorElement.download).toBe('downloaded-file.txt');

      // Verify DOM interactions
      if (typeof global.document !== 'undefined') {
        expect(document.body.appendChild).toHaveBeenCalledWith(mockAnchorElement);
        expect(mockAnchorElement.click).toHaveBeenCalled();
        expect(document.body.removeChild).toHaveBeenCalledWith(mockAnchorElement);
      } else {
        expect(mockAppendChild).toHaveBeenCalledWith(mockAnchorElement);
        expect(mockAnchorElement.click).toHaveBeenCalled();
        expect(mockRemoveChild).toHaveBeenCalledWith(mockAnchorElement);
      }

      // Verify cleanup
      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });

    it('throws error when download fails', async () => {
      mockDownload.mockResolvedValue({
        data: null,
        error: { message: 'Download failed from storage' }
      });

      await expect(downloadFile('my-bucket', 'path/to/file.txt', 'file.txt')).rejects.toThrow('Download failed: Download failed from storage');
    });

    it('throws error when data is missing but no error', async () => {
      mockDownload.mockResolvedValue({
        data: null,
        error: null
      });

      await expect(downloadFile('my-bucket', 'path/to/file.txt', 'file.txt')).rejects.toThrow('Download failed: undefined');
    });
  });
});
