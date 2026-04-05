const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000';

export interface GuestSessionResponse {
  sessionId: string;
  guestName: string;
}

export async function postGuestSession(): Promise<GuestSessionResponse> {
  const res = await fetch(`${API_URL}/auth/guest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`POST /auth/guest failed: ${res.status}`);
  return (await res.json()) as GuestSessionResponse;
}

export interface LinkSessionResponse {
  success: boolean;
  firebaseUid: string;
}

export async function postLinkSession(
  idToken: string,
  sessionId: string | null,
): Promise<LinkSessionResponse> {
  const res = await fetch(`${API_URL}/auth/link`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ sessionId }),
  });
  if (!res.ok) throw new Error(`POST /auth/link failed: ${res.status}`);
  return (await res.json()) as LinkSessionResponse;
}
