import { config } from "../shared/config/env";

interface TriggerResponse {
  job_id: string;
  status: string;
}

interface SourceInfo {
  id: string;
  category: string;
  seed_url: string;
}

interface SourcesResponse {
  sources: SourceInfo[];
}

interface VerifyOutcomeRequest {
  source_url: string;
  question: string;
  resolution_context: string;
}

interface VerifyOutcomeResponse {
  outcome: boolean | null;
  confidence: number;
  evidence: string;
}

class DataServiceClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = config.dataServiceUrl;
  }

  async getSources(): Promise<SourceInfo[]> {
    const response = await fetch(`${this.baseUrl}/sources`);
    if (!response.ok) {
      throw new Error(`Data Service error (${response.status})`);
    }
    const data = (await response.json()) as SourcesResponse;
    return data.sources;
  }

  async triggerGeneration(
    sourceIds: string[],
    targetCount: number = 5
  ): Promise<TriggerResponse> {
    const response = await fetch(`${this.baseUrl}/generate-markets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source_ids: sourceIds, target_count: targetCount }),
    });
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Data Service error (${response.status}): ${error}`);
    }
    return (await response.json()) as TriggerResponse;
  }

  async verifyOutcome(
    request: VerifyOutcomeRequest
  ): Promise<VerifyOutcomeResponse> {
    const response = await fetch(`${this.baseUrl}/verify-outcome`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    if (!response.ok) {
      throw new Error(`Data Service verify error (${response.status})`);
    }
    return (await response.json()) as VerifyOutcomeResponse;
  }

  async enrichMarket(
    question: string,
    sourceUrl: string
  ): Promise<{ description: string; category: string; resolution_context: string }> {
    const response = await fetch(`${this.baseUrl}/enrich-market`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, source_url: sourceUrl }),
    });
    if (!response.ok) {
      throw new Error(`Data Service enrich error (${response.status})`);
    }
    return response.json() as Promise<{ description: string; category: string; resolution_context: string }>;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }
}

export const dataServiceClient = new DataServiceClient();
export type { TriggerResponse, SourceInfo, VerifyOutcomeRequest, VerifyOutcomeResponse };
