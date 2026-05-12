import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getSignedUrl, downloadFile } from './download.ts';

// We need to mock the createClient BEFORE the module is imported
vi.mock('@supabase/supabase-js', () => {
  const mCreateSignedUrl = vi.fn();
  const mDownload = vi.fn();
  const mFrom = vi.fn(() => ({
    createSignedUrl: mCreateSignedUrl,
    download: mDownload
  }));
  const mCreateClient = vi.fn(() => ({
    storage: {
      from: mFrom
    }
  }));
  return {
    createClient: mCreateClient
  };
});

// Now we can import the client we mocked to assert on it
import { createClient } from '@supabase/supabase-js';

describe('download.ts', () => {
  let mockCreateSignedUrl: any;
  let mockDownload: any;
  let mockFrom: any;

  beforeEach(() => {
    vi.clearAllMocks();
    // Get references to the mocked functions
    const client = createClient('url', 'key');
    mockFrom = client.storage.from;
    mockCreateSignedUrl = client.storage.from('bucket').createSignedUrl;
    mockDownload = client.storage.from('bucket').download;
  });

  describe('getSignedUrl', () => {
    it('should generate a signed url successfully', async () => {
      mockCreateSignedUrl.mockResolvedValueOnce({
        data: { signedUrl: 'https://example.com/signed' },
        error: null
      });

      const url = await getSignedUrl('bucket1', 'path/to/file.txt', 3600);

      expect(url).toBe('https://example.com/signed');
      expect(mockFrom).toHaveBeenCalledWith('bucket1');
      expect(mockCreateSignedUrl).toHaveBeenCalledWith('path/to/file.txt', 3600);
    });

    it('should throw an error when supabase returns an error', async () => {
      mockCreateSignedUrl.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database error' }
      });

      await expect(getSignedUrl('bucket1', 'path/to/file.txt')).rejects.toThrow('Failed to generate signed URL: Database error');
    });

    it('should throw an error when supabase does not return a signed url', async () => {
      mockCreateSignedUrl.mockResolvedValueOnce({
        data: {}, // Missing signedUrl
        error: null
      });

      await expect(getSignedUrl('bucket1', 'path/to/file.txt')).rejects.toThrow('Failed to generate signed URL: undefined');
    });
  });

  describe('downloadFile', () => {
    let originalURL: typeof URL;
    let mockCreateObjectURL: any;
    let mockRevokeObjectURL: any;

    beforeEach(() => {
      // Mock DOM and URL API
      mockCreateObjectURL = vi.fn().mockReturnValue('blob:mock-url');
      mockRevokeObjectURL = vi.fn();

      originalURL = global.URL;
      global.URL = {
        ...originalURL,
        createObjectURL: mockCreateObjectURL,
        revokeObjectURL: mockRevokeObjectURL
      } as any;

      // We don't have document in vitest node environment, so we need to mock it
      // if it's not present (like in jsdom environment)
      if (typeof document === 'undefined') {
        const mockAppendChild = vi.fn();
        const mockRemoveChild = vi.fn();
        const mockClick = vi.fn();

        global.document = {
          createElement: vi.fn().mockReturnValue({
            href: '',
            download: '',
            click: mockClick
          }),
          body: {
            appendChild: mockAppendChild,
            removeChild: mockRemoveChild
          }
        } as any;
      } else {
        // If we are in jsdom or similar
        // const createElementSpy = vi.spyOn(document, 'createElement');
        // const appendChildSpy = vi.spyOn(document.body, 'appendChild');
        // const removeChildSpy = vi.spyOn(document.body, 'removeChild');
        // We'll rely on the real implementations or spys
      }
    });

    afterEach(() => {
      global.URL = originalURL;
    });

    it('should throw an error when supabase download returns an error', async () => {
      mockDownload.mockResolvedValueOnce({
        data: null,
        error: { message: 'Download failed from server' }
      });

      await expect(downloadFile('bucket1', 'path/to/file.txt', 'file.txt')).rejects.toThrow('Download failed: Download failed from server');
    });

    it('should throw an error when supabase download returns no data', async () => {
      mockDownload.mockResolvedValueOnce({
        data: null,
        error: null
      });

      await expect(downloadFile('bucket1', 'path/to/file.txt', 'file.txt')).rejects.toThrow('Download failed: undefined');
    });

    it('should download a file successfully', async () => {
      const mockBlob = new Blob(['test content'], { type: 'text/plain' });

      mockDownload.mockResolvedValueOnce({
        data: mockBlob,
        error: null
      });

      const mockAnchor = {
        href: '',
        download: '',
        click: vi.fn()
      };

      // Override document specifically for this test
      const mockAppendChild = vi.fn();
      const mockRemoveChild = vi.fn();
      global.document = {
        createElement: vi.fn().mockReturnValue(mockAnchor),
        body: {
          appendChild: mockAppendChild,
          removeChild: mockRemoveChild
        }
      } as any;

      await downloadFile('bucket1', 'path/to/file.txt', 'test.txt');

      expect(mockFrom).toHaveBeenCalledWith('bucket1');
      expect(mockDownload).toHaveBeenCalledWith('path/to/file.txt');

      expect(mockCreateObjectURL).toHaveBeenCalledWith(mockBlob);
      expect(global.document.createElement).toHaveBeenCalledWith('a');
      expect(mockAnchor.href).toBe('blob:mock-url');
      expect(mockAnchor.download).toBe('test.txt');
      expect(mockAppendChild).toHaveBeenCalledWith(mockAnchor);
      expect(mockAnchor.click).toHaveBeenCalled();
      expect(mockRemoveChild).toHaveBeenCalledWith(mockAnchor);
      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });
  });
});
