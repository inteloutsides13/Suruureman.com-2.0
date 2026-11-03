export type RadioUploadSessionRequest = {
  audioId: number;
  objectKey: string;
  contentType: string;
  sizeBytes: number;
  sha256?: string;
};

export type RadioObjectMetadata = {
  objectKey: string;
  contentType: string;
  sizeBytes: number;
  sha256: string;
};

export interface RadioStorageProvider {
  createUploadSession(request: RadioUploadSessionRequest): Promise<{
    uploadId: string;
    uploadUrl: string;
    objectKey: string;
    expiresAt: Date;
  }>;
  completeUpload(uploadId: string): Promise<RadioObjectMetadata>;
  getObjectMetadata(objectKey: string): Promise<RadioObjectMetadata>;
  getObject(objectKey: string): Promise<unknown>;
  createReadAccess(objectKey: string, expiresInSeconds: number): Promise<string>;
  archiveObject(objectKey: string): Promise<void>;
  deleteObject(objectKey: string): Promise<void>;
}

export class RadioStorageNotConfiguredError extends Error {
  constructor() {
    super("Radio object storage provider is not configured");
    this.name = "RadioStorageNotConfiguredError";
  }
}

/**
 * Provider-neutral boundary. A concrete provider is intentionally not selected
 * in Phase 2, so every byte operation fails closed instead of writing to the
 * deployment filesystem or silently using an ephemeral fallback.
 */
class UnconfiguredRadioStorageProvider implements RadioStorageProvider {
  private unavailable(): never {
    throw new RadioStorageNotConfiguredError();
  }

  createUploadSession(_request: RadioUploadSessionRequest): Promise<{
    uploadId: string;
    uploadUrl: string;
    objectKey: string;
    expiresAt: Date;
  }> {
    return this.unavailable();
  }

  completeUpload(_uploadId: string): Promise<RadioObjectMetadata> {
    return this.unavailable();
  }

  getObjectMetadata(_objectKey: string): Promise<RadioObjectMetadata> {
    return this.unavailable();
  }

  getObject(_objectKey: string): Promise<unknown> {
    return this.unavailable();
  }

  createReadAccess(_objectKey: string, _expiresInSeconds: number): Promise<string> {
    return this.unavailable();
  }

  archiveObject(_objectKey: string): Promise<void> {
    return this.unavailable();
  }

  deleteObject(_objectKey: string): Promise<void> {
    return this.unavailable();
  }
}

export function getRadioStorageProvider(): RadioStorageProvider {
  return new UnconfiguredRadioStorageProvider();
}