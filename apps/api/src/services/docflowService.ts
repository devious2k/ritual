const DOCFLOW_API_URL = process.env.DOCFLOW_API_URL || 'http://localhost:4000';

interface AuthToken {
  token: string;
  expiresAt: number;
}

export class DocFlowService {
  private email: string;
  private password: string;
  private authToken: AuthToken | null = null;

  constructor() {
    this.email = process.env.DOCFLOW_EMAIL || '';
    this.password = process.env.DOCFLOW_PASSWORD || '';
  }

  async login(): Promise<string> {
    if (this.authToken && Date.now() < this.authToken.expiresAt - 60_000) {
      return this.authToken.token;
    }

    const response = await fetch(`${DOCFLOW_API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: this.email,
        password: this.password,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`DocFlow login error (${response.status}): ${error}`);
    }

    const data = (await response.json()) as any;

    this.authToken = {
      token: data.token || data.accessToken,
      // Default to 7 hours if no expiry provided
      expiresAt: Date.now() + (data.expiresIn || 25200) * 1000,
    };

    return this.authToken.token;
  }

  private async request(
    method: string,
    path: string,
    options?: { body?: any; formData?: FormData },
  ): Promise<any> {
    const token = await this.login();

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };

    let body: any;
    if (options?.formData) {
      body = options.formData;
    } else if (options?.body) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(options.body);
    }

    const response = await fetch(`${DOCFLOW_API_URL}${path}`, {
      method,
      headers,
      body,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`DocFlow API error (${response.status}): ${error}`);
    }

    return response.json();
  }

  async uploadDocument(
    siteId: string,
    file: Buffer,
    name: string,
  ): Promise<any> {
    const formData = new FormData();
    formData.append('file', new Blob([file]), name);
    formData.append('siteId', siteId);
    formData.append('name', name);

    return this.request('POST', '/documents/upload', { formData });
  }

  async getDocument(documentId: string): Promise<any> {
    return this.request('GET', `/documents/${documentId}`);
  }

  async searchDocuments(siteId: string, query: string): Promise<any> {
    const params = new URLSearchParams({ siteId, query });
    return this.request('GET', `/documents/search?${params.toString()}`);
  }
}
