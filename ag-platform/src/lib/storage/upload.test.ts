import { describe, it, expect, vi, beforeEach } from 'vitest';
import { uploadFileResumable } from './upload.ts';

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getSession: () => Promise.resolve({
        data: {
          session: globalThis.mockSessionValue
        }
      })
    }
  })
}));

// Mock console.error to avoid spamming the test output with our intentional error logs
vi.spyOn(console, 'error').mockImplementation(() => {});

// Mock tus
vi.mock('tus-js-client', () => {
  return {
    Upload: vi.fn().mockImplementation(function(file, options) {
      this.findPreviousUploads = vi.fn().mockResolvedValue([]);
      this.resumeFromPreviousUpload = vi.fn();
      this.start = vi.fn().mockImplementation(() => {
        // Trigger onError immediately to resolve the promise
        if (options && options.onError) {
          options.onError(new Error('TUS_UPLOAD_STARTED'));
        }
      });
      return this;
    })
  };
});

describe('uploadFileResumable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.mockSessionValue = { access_token: 'fake-token', user: { id: 'user-id' } };
  });

  it('throws an error if the user is unauthorized', async () => {
    globalThis.mockSessionValue = null;
    const file = { size: 100, name: 'test.txt', type: 'text/plain' } as unknown as File;
    await expect(
      uploadFileResumable(file, 'bucket-id', 'org-id', undefined, undefined, () => {})
    ).rejects.toThrow('Unauthorized');
  });

  it('throws an error if the file exceeds the 100MB limit', async () => {
    const largeFile = {
      size: 100 * 1024 * 1024 + 1, // 100MB + 1 byte
      name: 'large.txt',
      type: 'text/plain'
    } as unknown as File;

    await expect(
      uploadFileResumable(largeFile, 'bucket-id', 'org-id', undefined, undefined, () => {})
    ).rejects.toThrow('File exceeds 100MB limit.');
  });

  it('does not throw size error if file is exactly 100MB', async () => {
    const validFile = {
      size: 100 * 1024 * 1024, // Exactly 100MB
      name: 'valid.txt',
      type: 'text/plain'
    } as unknown as File;

    // It should get past validation and try to upload, hitting our mocked 'TUS_UPLOAD_STARTED' error
    await expect(
      uploadFileResumable(validFile, 'bucket-id', 'org-id', undefined, undefined, () => {})
    ).rejects.toThrow('TUS_UPLOAD_STARTED');
  });

  it('does not throw size error if file is smaller than 100MB', async () => {
    const smallFile = {
      size: 50 * 1024 * 1024, // 50MB
      name: 'small.txt',
      type: 'text/plain'
    } as unknown as File;

    await expect(
      uploadFileResumable(smallFile, 'bucket-id', 'org-id', undefined, undefined, () => {})
    ).rejects.toThrow('TUS_UPLOAD_STARTED');
  });
});

declare global {
  var mockSessionValue: any;
}
