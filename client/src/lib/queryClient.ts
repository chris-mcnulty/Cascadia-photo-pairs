import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let errorMessage = res.statusText;
    try {
      const text = await res.text();
      if (text) {
        // Try to parse as JSON to get structured error
        try {
          const errorData = JSON.parse(text);
          errorMessage = errorData.message || errorData.details || text;
        } catch {
          // If not JSON, use the text as-is
          errorMessage = text;
        }
      }
    } catch {
      // If reading text fails, use statusText
      errorMessage = res.statusText;
    }
    
    console.error(`HTTP Error ${res.status}:`, errorMessage);
    throw new Error(errorMessage);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
  additionalHeaders?: Record<string, string>
): Promise<Response> {
  const headers: Record<string, string> = data ? { "Content-Type": "application/json" } : {};
  
  // Automatically include authentication headers
  // Include session ID for admin authenticated requests
  const sessionId = localStorage.getItem('admin-session-id');
  if (sessionId) {
    headers['x-session-id'] = sessionId;
    console.log('[apiRequest] Added admin session ID header');
  }
  
  // Include JWT token for user authenticated requests
  const authToken = localStorage.getItem('auth-token');
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
    console.log('[apiRequest] Added JWT Authorization header');
  }
  
  // Add any additional headers passed in (these can override the automatic ones)
  if (additionalHeaders) {
    Object.assign(headers, additionalHeaders);
  }

  console.log(`API Request: ${method} ${url}`, { 
    hasData: !!data, 
    dataSize: data ? JSON.stringify(data).length : 0,
    headers: Object.keys(headers)
  });

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });

    console.log(`API Response: ${method} ${url}`, { 
      status: res.status, 
      statusText: res.statusText,
      ok: res.ok 
    });

    await throwIfResNotOk(res);
    return res;
  } catch (error) {
    console.error(`API Request Failed: ${method} ${url}`, error);
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const headers: Record<string, string> = {};
    
    // Include session ID for admin authenticated requests
    const sessionId = localStorage.getItem('admin-session-id');
    if (sessionId) {
      headers['x-session-id'] = sessionId;
      console.log('[QueryFn] Added admin session ID header');
    }
    
    // Include JWT token for user authenticated requests
    const authToken = localStorage.getItem('auth-token');
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
      console.log('[QueryFn] Added JWT Authorization header');
    }

    console.log('[QueryFn] Fetching:', queryKey.join("/"), 'with headers:', Object.keys(headers));
    
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
      headers,
    });

    console.log('[QueryFn] Response status:', res.status);
    
    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    const data = await res.json();
    console.log('[QueryFn] Response data:', data);
    return data;
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
