

const BASE_URL = "http://localhost:3000"; 
// const BASE_URL = "http://192.168.18.121:3000"; 

function apiClientInit() {
  const request = async <T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> => {
    try {

      console.log(`${BASE_URL}${endpoint}`);
      // Enhanced request logging
      console.log('API request →', {
        url: `${BASE_URL}${endpoint}`,
        method: options.method ?? 'GET',
        headers: options.headers,
        bodyPreview: typeof options.body === 'string' ? options.body.slice(0, 500) : options.body
      });

      const response = await fetch(`${BASE_URL}${endpoint}`, {
        ...options,
        headers: {
          ...options.headers,
        },
      });

      // Log response early (without consuming it)
      const responseClone = response.clone();
      const responseText = await responseClone.text().catch(() => '<non-text body>');
      console.log('API response ←', {
        status: response.status,
        ok: response.ok,
        contentType: response.headers.get('content-type'),
        bodyPreview: responseText.slice(0, 1000)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const responseJson = await response.json();

      return responseJson.data;
    } catch (error) {
      console.error("API request failed:", error);
      // Enhanced error logging
      console.error('API request failed (details):', {
        name: (error as any)?.name,
        message: (error as any)?.message,
        stack: (error as any)?.stack
      });
      throw error;
    }
  };

  // Convenience methods for common HTTP methods
  const get = <T>(endpoint: string, options?: RequestInit) =>
    request<T>(endpoint, { ...options, method: "GET" });

  const post = <T>(endpoint: string, data: any, options?: RequestInit) =>
    request<T>(endpoint, {
      ...options,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
      body: JSON.stringify(data),
    });

  const put = <T>(endpoint: string, data: any, options?: RequestInit) =>
    request<T>(endpoint, {
      ...options,
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
      body: JSON.stringify(data),
    });

  const del = <T>(endpoint: string, options?: RequestInit) =>
    request<T>(endpoint, { ...options, method: "DELETE" });

  return {
    request,
    get,
    post,
    put,
    delete: del,
  };
}


export const apiClient = apiClientInit();