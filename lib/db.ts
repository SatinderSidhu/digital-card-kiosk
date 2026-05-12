import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { CardDetails, TemplateId } from "./types";

/** Days a session/review lives in DynamoDB before TTL deletes it. */
const TTL_DAYS = 30;

export type SessionRecord = {
  id: string;
  details: CardDetails;
  template: TemplateId;
  photoDataUrl: string | null;
  /** Public S3 URL of the rendered-card JPEG snapshot. Set by the
   *  email-send route the first time the customer's snapshot is captured;
   *  reused by `/c/[id]` as the OpenGraph image so share-link unfurls
   *  preview the actual card. Optional because older rows from before
   *  this column existed don't have it. */
  cardImageUrl?: string | null;
  /** Capability token for the manage page at `/c/[id]/edit?t=<editToken>`.
   *  Whoever holds this can edit the card's details / template / photo —
   *  same security posture as the public card link (whoever holds the
   *  random `id` can view it). Generated at session-create time;
   *  lazily backfilled by the email route for older rows. */
  editToken?: string;
  /** Unix seconds. */
  createdAt: number;
  /** Unix seconds. DynamoDB's TTL feature deletes the row when this passes. */
  expiresAt: number;
};

export type ReviewRecord = {
  id: string;
  name: string;
  title: string | null;
  email: string;
  videoUrl: string;
  videoMimeType: string;
  /** Unix seconds. */
  createdAt: number;
  /** Unix seconds — DynamoDB TTL. */
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

function reviewsTableName(): string {
  const t = process.env.DYNAMODB_REVIEWS_TABLE;
  if (!t) {
    throw new Error(
      "DYNAMODB_REVIEWS_TABLE env var is not set — cannot reach the reviews table.",
    );
  }
  return t;
}

export function isDbConfigured(): boolean {
  return !!process.env.DYNAMODB_TABLE;
}

export function isReviewsDbConfigured(): boolean {
  return !!process.env.DYNAMODB_REVIEWS_TABLE;
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

/** Patch the `cardImageUrl` on an existing session row. Called from the
 *  email-send route after the rendered-card snapshot is uploaded to S3. */
export async function setSessionCardImage(
  id: string,
  cardImageUrl: string,
): Promise<void> {
  await getClient().send(
    new UpdateCommand({
      TableName: tableName(),
      Key: { id },
      UpdateExpression: "SET cardImageUrl = :url",
      ExpressionAttributeValues: { ":url": cardImageUrl },
    }),
  );
}

/** Patch the `editToken` on an existing session row — used to lazily
 *  backfill rows created before the manage feature shipped. */
export async function setSessionEditToken(
  id: string,
  editToken: string,
): Promise<void> {
  await getClient().send(
    new UpdateCommand({
      TableName: tableName(),
      Key: { id },
      UpdateExpression: "SET editToken = :t",
      ExpressionAttributeValues: { ":t": editToken },
    }),
  );
}

/** Apply a cardholder edit from the manage page. Only the mutable fields
 *  (details, template, photoDataUrl, cardImageUrl) are touched — `id`,
 *  `editToken`, `createdAt`, `expiresAt` are left intact. */
export async function updateSession(
  id: string,
  patch: {
    details: CardDetails;
    template: TemplateId;
    photoDataUrl: string | null;
    cardImageUrl: string | null;
  },
): Promise<void> {
  await getClient().send(
    new UpdateCommand({
      TableName: tableName(),
      Key: { id },
      UpdateExpression:
        "SET details = :d, template = :t, photoDataUrl = :p, cardImageUrl = :c",
      ExpressionAttributeValues: {
        ":d": patch.details,
        ":t": patch.template,
        ":p": patch.photoDataUrl,
        ":c": patch.cardImageUrl,
      },
    }),
  );
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

/** List all sessions. Scan is fine at kiosk scale (<10k rows); switch to a
 *  GSI on createdAt if this grows. Sorted newest-first. */
export async function listSessions(): Promise<SessionRecord[]> {
  const items: SessionRecord[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const res = await getClient().send(
      new ScanCommand({
        TableName: tableName(),
        ExclusiveStartKey: lastKey,
      }),
    );
    if (res.Items) items.push(...(res.Items as SessionRecord[]));
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);
  items.sort((a, b) => b.createdAt - a.createdAt);
  return items;
}

export async function saveReview(
  record: Omit<ReviewRecord, "createdAt" | "expiresAt">,
): Promise<ReviewRecord> {
  const now = Math.floor(Date.now() / 1000);
  const full: ReviewRecord = {
    ...record,
    createdAt: now,
    expiresAt: now + TTL_DAYS * 24 * 60 * 60,
  };
  await getClient().send(
    new PutCommand({
      TableName: reviewsTableName(),
      Item: full,
    }),
  );
  return full;
}

export async function getReview(id: string): Promise<ReviewRecord | null> {
  const result = await getClient().send(
    new GetCommand({
      TableName: reviewsTableName(),
      Key: { id },
      ConsistentRead: true,
    }),
  );
  return (result.Item as ReviewRecord | undefined) ?? null;
}

export async function listReviews(): Promise<ReviewRecord[]> {
  const items: ReviewRecord[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const res = await getClient().send(
      new ScanCommand({
        TableName: reviewsTableName(),
        ExclusiveStartKey: lastKey,
      }),
    );
    if (res.Items) items.push(...(res.Items as ReviewRecord[]));
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);
  items.sort((a, b) => b.createdAt - a.createdAt);
  return items;
}
