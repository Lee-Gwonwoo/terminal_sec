import type { Response } from "express";
import type { NewsItem, NewsQuery } from "../types.js";
import { matchesNewsFilters } from "../services/newsFilterMatcher.js";

type Client = {
  id: string;
  response: Response;
  filters: NewsQuery;
};

export class StreamHub {
  private clients = new Map<string, Client>();

  addClient(client: Client): void {
    this.clients.set(client.id, client);
  }

  removeClient(clientId: string): void {
    this.clients.delete(clientId);
  }

  publishNews(item: NewsItem): void {
    const payload = JSON.stringify({ type: "news_item", payload: item });
    for (const client of this.clients.values()) {
      if (!matchesNewsFilters(item, client.filters)) {
        continue;
      }
      client.response.write(`data: ${payload}\n\n`);
    }
  }

  heartbeat(): void {
    for (const client of this.clients.values()) {
      client.response.write("event: heartbeat\ndata: {}\n\n");
    }
  }
}
