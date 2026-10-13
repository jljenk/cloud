import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import {
  MAX_SUBMISSIONS,
  handleRequest,
  type ApiRequest,
  type CloudRecord,
  type Store,
  type Submission,
} from './core.ts';

const documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

type GatewayEvent = {
  rawPath?: string;
  body?: string | null;
  isBase64Encoded?: boolean;
  requestContext?: { http?: { method?: string } };
  headers?: Record<string, string | undefined>;
};

export const handler = async (event: GatewayEvent) => {
  const method = event.requestContext?.http?.method ?? 'GET';
  const path = event.rawPath ?? '/';
  const request: ApiRequest = {
    method,
    path,
    headers: event.headers ?? {},
    body: decodeBody(event),
  };

  try {
    const result = await handleRequest(createDynamoStore(), request);
    console.log(JSON.stringify({ method, path, statusCode: result.statusCode }));
    return {
      statusCode: result.statusCode,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(result.body),
    };
  } catch (error) {
    console.log(JSON.stringify({ method, path, statusCode: 500, error: errorName(error) }));
    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ error: 'Something went wrong.' }),
    };
  }
};

function createDynamoStore(): Store {
  return {
    async create(record) {
      await documentClient.send(
        new PutCommand({
          TableName: tableName(),
          Item: record,
          ConditionExpression: 'attribute_not_exists(id)',
        }),
      );
    },
    async get(id) {
      const result = await documentClient.send(
        new GetCommand({
          TableName: tableName(),
          Key: { id },
        }),
      );
      return asCloud(result.Item);
    },
    async addSubmission(id, submission) {
      try {
        await documentClient.send(
          new UpdateCommand({
            TableName: tableName(),
            Key: { id },
            UpdateExpression:
              'SET submissions = list_append(if_not_exists(submissions, :empty), :item), submissionCount = submissionCount + :one',
            ConditionExpression: 'attribute_exists(id) AND submissionCount < :max',
            ExpressionAttributeValues: {
              ':empty': [],
              ':item': [submission],
              ':one': 1,
              ':max': MAX_SUBMISSIONS,
            },
          }),
        );
        return 'ok';
      } catch (error) {
        if (!isConditionalCheckFailed(error)) throw error;
        const existing = await this.get(id);
        return existing ? 'full' : 'missing';
      }
    },
    reveal(id) {
      return setRevealed(id, true);
    },
    hide(id) {
      return setRevealed(id, false);
    },
  };
}

async function setRevealed(id: string, revealed: boolean): Promise<'ok' | 'missing'> {
  try {
    await documentClient.send(
      new UpdateCommand({
        TableName: tableName(),
        Key: { id },
        UpdateExpression: 'SET revealed = :revealed',
        ConditionExpression: 'attribute_exists(id)',
        ExpressionAttributeValues: { ':revealed': revealed },
      }),
    );
    return 'ok';
  } catch (error) {
    if (!isConditionalCheckFailed(error)) throw error;
    return 'missing';
  }
}

function tableName(): string {
  const name = process.env.TABLE_NAME;
  if (!name) throw new Error('TABLE_NAME is not set');
  return name;
}

function asCloud(item: Record<string, unknown> | undefined): CloudRecord | null {
  if (!item || typeof item.id !== 'string' || typeof item.adminSecretHash !== 'string') return null;
  const submissions = Array.isArray(item.submissions) ? item.submissions.flatMap(asSubmission) : [];
  return {
    id: item.id,
    title: typeof item.title === 'string' ? item.title : 'Word cloud',
    adminSecretHash: item.adminSecretHash,
    revealed: item.revealed === true,
    submissionCount: typeof item.submissionCount === 'number' ? item.submissionCount : submissions.length,
    submissions,
    createdAt: typeof item.createdAt === 'string' ? item.createdAt : '',
  };
}

function asSubmission(value: unknown): Submission[] {
  if (!value || typeof value !== 'object') return [];
  const submission = value as { text?: unknown; at?: unknown };
  if (typeof submission.text !== 'string') return [];
  return [{ text: submission.text, at: typeof submission.at === 'string' ? submission.at : '' }];
}

function decodeBody(event: GatewayEvent): string | undefined {
  if (!event.body) return undefined;
  if (!event.isBase64Encoded) return event.body;
  return Buffer.from(event.body, 'base64').toString('utf8');
}

function isConditionalCheckFailed(error: unknown): boolean {
  return errorName(error) === 'ConditionalCheckFailedException';
}

function errorName(error: unknown): string {
  if (error instanceof Error) return error.name;
  return 'Error';
}
