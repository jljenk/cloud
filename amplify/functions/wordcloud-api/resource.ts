import { defineFunction } from '@aws-amplify/backend';

export const wordCloudApi = defineFunction({
  name: 'wordcloud-api',
  entry: './handler.ts',
  timeoutSeconds: 10,
  memoryMB: 256,
  architecture: 'arm64',
  runtime: 22,
  logging: {
    retention: '1 week',
  },
});
