const XERO_TOKEN_URL = 'https://identity.xero.com/connect/token';
const XERO_API_BASE = 'https://api.xero.com/api.xro/2.0';

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

export class XeroService {
  private clientId: string;
  private clientSecret: string;
  private tokenCache: TokenCache | null = null;

  constructor() {
    this.clientId = process.env.XERO_CLIENT_ID || '';
    this.clientSecret = process.env.XERO_CLIENT_SECRET || '';
  }

  async getAccessToken(): Promise<string> {
    if (this.tokenCache && Date.now() < this.tokenCache.expiresAt - 60_000) {
      return this.tokenCache.accessToken;
    }

    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

    const response = await fetch(XERO_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'accounting.contacts accounting.transactions',
      }).toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Xero token error (${response.status}): ${error}`);
    }

    const data = (await response.json()) as any;

    this.tokenCache = {
      accessToken: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };

    return this.tokenCache.accessToken;
  }

  private async request(
    tenantId: string,
    method: string,
    path: string,
    body?: any,
  ): Promise<any> {
    const accessToken = await this.getAccessToken();

    const response = await fetch(`${XERO_API_BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'Xero-Tenant-Id': tenantId,
      },
      ...(body && { body: JSON.stringify(body) }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Xero API error (${response.status}): ${error}`);
    }

    return response.json();
  }

  async createContact(tenantId: string, contact: any): Promise<any> {
    return this.request(tenantId, 'POST', '/Contacts', {
      Contacts: [contact],
    });
  }

  async createInvoice(tenantId: string, invoice: any): Promise<any> {
    return this.request(tenantId, 'POST', '/Invoices', {
      Invoices: [invoice],
    });
  }

  async syncPayment(tenantId: string, payment: any): Promise<any> {
    return this.request(tenantId, 'POST', '/Payments', {
      Payments: [payment],
    });
  }
}
