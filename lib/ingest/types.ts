// lib/ingest/types.ts
import type { ProviderName, ProviderSearchIntent } from "@/lib/providers/types";

export type IngestStatus = "success" | "error";

export type IngestSummary = {
    status: IngestStatus;

    runId?: number | null;
    cached?: boolean;

    provider: ProviderName;
    requestId?: string;

    fetchedCount: number;
    returnedCount: number;

    insertedRaw: number;
    skippedDuplicates: number;

    nextCursor?: string | null;
    exhausted?: boolean;

    retryable?: boolean;
    retryAfterSeconds?: number;

    error?: {
        code: string;
        message: string;
        retryable?: boolean;
    };

    intent: ProviderSearchIntent;
};
