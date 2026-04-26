import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import type { CardDetails, TemplateId } from "./types";

/** Days a session lives in DynamoDB before TTL deletes it. */
const TTL_DAYS = 30;

export type SessionRecord = {
  id: string;
  details: CardDetails;
  template: TemplateId;
  photoDataUrl: string | null;
  /** Unix seconds. */
  createdAt: number;
  /** Unix seconds. DynamoDB's TTL feature deletes the row when this passes. */
  expiresAt: number;
};

let docClient: DynamoDBDocumentClient | null = null;

function getClient(): DynamoDBDocumentClient {
  if (!docClient) {
    const region = process.env.AWS_REGION ?? "us-east-1";
    const ddb = new DynamoDBClient({ region });
    docClient = DynamoDBDocumentClient.from(ddb, {
      marshallOptions: {
        removeUndefinedValues: true,
        convertEmptyValues: false,
      },
    });
  }
  return docClient;
}

function tableName(): string {
  const t = process.env.DYNAMODB_TABLE;
  if (!t) {
    throw new Error(
      "DYNAMODB_TABLE env var is not set — cannot reach the sessions table.",
    );
  }
  return t;
}

export function isDbConfigured(): boolean {
  return !!process.env.DYNAMODB_TABLE;
}

/**
 * Save (or overwrite) a session row. Uses on-demand DynamoDB billing so
 * no provisioned capacity is needed. The 400 KB Dynamo item limit covers
 * a 1280×720 JPEG comfortably; oversized photos fail loudly.
 */
export async function saveSession(
  record: Omit<SessionRecord, "createdAt" | "expiresAt">,
): Promise<SessionRecord> {
  const now = Math.floor(Date.now() / 1000);
  const full: SessionRecord = {
    ...record,
    createdAt: now,
    expiresAt: now + TTL_DAYS * 24 * 60 * 60,
  };
  await getClient().send(
    new PutCommand({
      TableName: tableName(),
      Item: full,
    }),
  );
  return full;
}

/** Fetch a session by id. Returns null if it doesn't exist (or has been
 *  TTL-evicted). */
export async function getSession(id: string): Promise<SessionRecord | null> {
  const result = await getClient().send(
    new GetCommand({
      TableName: tableName(),
      Key: { id },
      ConsistentRead: true,
    }),
  );
  return (result.Item as SessionRecord | undefined) ?? null;
}
