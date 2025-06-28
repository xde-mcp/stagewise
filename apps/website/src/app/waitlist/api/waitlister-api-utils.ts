'use server';

interface WaitlisterResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

type SignUpResponse =
  | {
      success: true;
      is_new_signup: boolean;
      message: string;
      position: number;
      referral_code: string;
      redirect_url: string;
    }
  | {
      success: false;
      error: { code: string; message: string };
    };

interface Subscriber {
  id: string;
  email: string;
  deliverability: string;
  name: string;
  phone: string;
  position: number;
  points: number;
  referral_code: string;
  referred_by: string;
  referral_count: number;
  referring_domain: string;
  country: string;
  city: string;
  timezone: string;
  joined_with: string;
  joined_at: number;
  metadata: Record<string, any>;
}

interface SignUpData {
  email: string;
  name?: string;
  phone?: string;
  metadata?: {
    referred_by?: string;
    referring_domain?: string;
  } & Record<string, any>;
}

interface UpdateSubscriberData {
  name?: string;
  phone?: string;
  points?: number;
  metadata?: Record<string, any>;
}

interface ListSubscribersParams {
  page?: number;
  limit?: number;
  sort_by?: 'position' | 'points' | 'date' | 'referral_count' | 'email';
  sort_dir?: 'asc' | 'desc';
}

// Base API client class
class WaitlisterAPI {
  private baseUrl = 'https://waitlister.me/api/v1';

  private async makeRequest<T>(
    endpoint: string,
    options: {
      method?: string;
      body?: any;
      headers?: Record<string, string>;
    } = {},
  ): Promise<WaitlisterResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'X-Api-Key': process.env.WAITLISTER_API_KEY!,
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        method: options.method || 'GET',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      const data = (await response.json()) as WaitlisterResponse<T>;

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}: ${data.error?.message || 'Unknown error'}`,
        );
      }

      return data;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Unknown error occurred');
    }
  }

  // Subscriber Endpoints
  async signUpSubscriber(data: SignUpData): Promise<SignUpResponse> {
    return this.makeRequest<SignUpResponse>(
      `/waitlist/${process.env.WAITLIST_KEY}/sign-up`,
      {
        method: 'POST',
        body: data,
      },
      // Too lazy to fix the types tbh, this is correct
    ) as unknown as SignUpResponse;
  }

  async listSubscribers(params: ListSubscribersParams = {}): Promise<
    WaitlisterResponse<{
      subscribers: Subscriber[];
      total: number;
      page: number;
      pages: number;
      limit: number;
    }>
  > {
    const queryParams = new URLSearchParams();

    if (params.page) queryParams.append('page', params.page.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.sort_by) queryParams.append('sort_by', params.sort_by);
    if (params.sort_dir) queryParams.append('sort_dir', params.sort_dir);

    const endpoint = `/waitlist/${process.env.WAITLIST_KEY}/subscribers${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

    return this.makeRequest(endpoint);
  }

  async getSubscriber(
    subscriberId: string,
  ): Promise<WaitlisterResponse<{ subscriber: Subscriber }>> {
    return this.makeRequest<{ subscriber: Subscriber }>(
      `/waitlist/${process.env.WAITLIST_KEY}/subscribers/${subscriberId}`,
    );
  }

  async updateSubscriber(
    subscriberId: string,
    data: UpdateSubscriberData,
  ): Promise<WaitlisterResponse<Subscriber>> {
    return this.makeRequest<Subscriber>(
      `/waitlist/${process.env.WAITLIST_KEY}/subscribers/${subscriberId}`,
      {
        method: 'PUT',
        body: data,
      },
    );
  }

  async deleteSubscriber(
    subscriberId: string,
  ): Promise<WaitlisterResponse<void>> {
    return this.makeRequest<void>(
      `/waitlist/${process.env.WAITLIST_KEY}/subscribers/${subscriberId}`,
      {
        method: 'DELETE',
      },
    );
  }

  async getSubscriberStats(): Promise<
    WaitlisterResponse<{
      total: number;
      today: number;
      thisWeek: number;
      thisMonth: number;
    }>
  > {
    return this.makeRequest(
      `/waitlist/${process.env.WAITLIST_KEY}/analytics/subscribers`,
    );
  }

  async getReferralStats(): Promise<
    WaitlisterResponse<{
      totalReferrals: number;
      conversionRate: number;
      topReferrers: Array<{ email: string; referrals: number }>;
    }>
  > {
    return this.makeRequest(
      `/waitlist/${process.env.WAITLIST_KEY}/analytics/referrals`,
    );
  }
}

// Individual endpoint functions for direct use
export async function signUpSubscriber(
  data: SignUpData,
): Promise<SignUpResponse> {
  const client = new WaitlisterAPI();
  return client.signUpSubscriber(data);
}

export async function listSubscribers(
  params: ListSubscribersParams = {},
): Promise<
  WaitlisterResponse<{
    subscribers: Subscriber[];
    total: number;
    page: number;
    limit: number;
    pages: number;
  }>
> {
  const client = new WaitlisterAPI();
  const subscribers = await client.listSubscribers(params);
  if (subscribers.data) {
    return {
      ...subscribers,
      data: {
        ...subscribers.data,
        subscribers: subscribers.data?.subscribers.map((subscriber) => ({
          ...subscriber,
          email: subscriber.email
            .replace(/(?<=.{2}).*(?=@)/g, '***') // mask username after first 2 chars
            .replace(/(?<=@.{3}).*(?=\.[a-zA-Z]{2,})/g, '***'), // mask domain but keep TLD
        })),
      },
    };
  }
  return subscribers;
}

export async function getSubscriber(
  subscriberId: string,
): Promise<WaitlisterResponse<{ subscriber: Subscriber }>> {
  const client = new WaitlisterAPI();
  return client.getSubscriber(subscriberId);
}

export async function updateSubscriber(
  subscriberId: string,
  data: UpdateSubscriberData,
): Promise<WaitlisterResponse<Subscriber>> {
  const client = new WaitlisterAPI();
  return client.updateSubscriber(subscriberId, data);
}

export async function deleteSubscriber(
  subscriberId: string,
): Promise<WaitlisterResponse<void>> {
  const client = new WaitlisterAPI();
  return client.deleteSubscriber(subscriberId);
}

export async function getSubscriberStats(): Promise<
  WaitlisterResponse<{
    total: number;
    today: number;
    thisWeek: number;
    thisMonth: number;
  }>
> {
  const client = new WaitlisterAPI();
  return client.getSubscriberStats();
}

export async function getReferralStats(): Promise<
  WaitlisterResponse<{
    totalReferrals: number;
    conversionRate: number;
    topReferrers: Array<{ email: string; referrals: number }>;
  }>
> {
  const client = new WaitlisterAPI();
  return client.getReferralStats();
}

// Export types for external use
export type {
  WaitlisterResponse,
  Subscriber,
  SignUpData,
  UpdateSubscriberData,
  ListSubscribersParams,
};

// Usage examples:
/*
// Sign up a new subscriber
const newSubscriber = await signUpSubscriber({
  email: 'user@example.com',
  name: 'John Doe'
});

// List all subscribers
const subscribers = await listSubscribers({
  page: 1,
  limit: 50,
  sort_by: 'position',
  sort_dir: 'desc'
});
*/
