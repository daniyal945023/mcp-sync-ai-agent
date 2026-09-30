const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type ClerkGetToken = () => Promise<string | null>;

type StoredDemoToken = {
  token: string;
  expiresAt: number;
};

let demoTokenRequest: Promise<string> | null = null;

async function getDemoToken(): Promise<string> {
  const storageKey = "support-ops-demo-token";
  const saved = sessionStorage.getItem(storageKey);

  if (saved) {
    try {
      const stored = JSON.parse(saved) as StoredDemoToken;
      if (stored.expiresAt > Date.now() + 30_000) {
        return stored.token;
      }
    } catch {
      sessionStorage.removeItem(storageKey);
    }
  }

  if (!demoTokenRequest) {
    demoTokenRequest = fetch(`${API_URL}/demo/session`, { method: "POST" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Could not start a demo session");
        }

        const result = (await response.json()) as {
          access_token: string;
          expires_in: number;
        };

        sessionStorage.setItem(
          storageKey,
          JSON.stringify({
            token: result.access_token,
            expiresAt: Date.now() + result.expires_in * 1000,
          } satisfies StoredDemoToken),
        );

        return result.access_token;
      })
      .finally(() => {
        demoTokenRequest = null;
      });
  }

  return demoTokenRequest;
}

export async function getApiToken(
  getClerkToken: ClerkGetToken,
): Promise<string | null> {
  if (window.location.pathname === "/demo") {
    return getDemoToken();
  }

  return getClerkToken();
}