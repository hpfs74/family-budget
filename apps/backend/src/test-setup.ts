// apps/backend/src/test-setup.ts
jest.mock('aws-xray-sdk-core', () => ({
  captureAWSv3Client: (client: unknown) => client,
}));
