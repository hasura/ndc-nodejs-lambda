export interface NdcClient {
  baseUrl: string;
  getHealth(): Promise<Response>;
  getCapabilities(): Promise<Response>;
  getSchema(): Promise<Response>;
  postQuery(body: unknown): Promise<Response>;
  postMutation(body: unknown): Promise<Response>;
}

export function createNdcClient(port: number): NdcClient {
  const baseUrl = `http://localhost:${port}`;

  async function get(path: string): Promise<Response> {
    return fetch(`${baseUrl}${path}`);
  }

  async function post(path: string, body: unknown): Promise<Response> {
    return fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  return {
    baseUrl,
    getHealth: () => get("/health"),
    getCapabilities: () => get("/capabilities"),
    getSchema: () => get("/schema"),
    postQuery: (body) => post("/query", body),
    postMutation: (body) => post("/mutation", body),
  };
}
