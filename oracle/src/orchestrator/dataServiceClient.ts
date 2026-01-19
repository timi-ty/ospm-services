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
export type { TriggerResponse, SourceInfo };
