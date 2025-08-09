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
  
  // Add any additional headers passed in (e.g., for authentication)
  if (additionalHeaders) {
    Object.assign(headers, additionalHeaders);
  }

  console.log(`API Request: ${method} ${url}`, { 
    hasData: !!data, 
    dataSize: data ? JSON.stringify(data).length : 0
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
    
    // Include session ID for authenticated requests
    const sessionId = localStorage.getItem('admin-session-id');
    if (sessionId) {
      headers['x-session-id'] = sessionId;
    }

    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
      headers,
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
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
