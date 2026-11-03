# Storage Configuration

## Current state

PostgreSQL stores application records and radio object metadata. The radio
storage adapter is provider-neutral. It records object keys, versions, sizes,
checksums, and processing metadata, but no concrete S3/R2/cloud provider is
configured in the source snapshot.

## Clone requirements

- Keep audio bytes in an approved object-storage provider, not PostgreSQL.
- Configure the provider through an operator-managed integration/secret.
- Preserve object keys and SHA-256 values during migration.
- Verify that browser playback and machine retrieval are actually reachable
  before claiming the stream is available.
- Treat storage failure as unavailable; do not silently fall back to fake media.

The existing radio table metadata is not a substitute for a byte-level storage
backup.