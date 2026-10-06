// Device credentials are never included in URLs. Only their SHA-256 hash is stored.
export async function sessionHash(token: string) {
 const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
 return Array.from(new Uint8Array(digest), x => x.toString(16).padStart(2, "0")).join("");
}
export async function issueSession(client: any, profile: { id: string }) {
 const bytes = crypto.getRandomValues(new Uint8Array(32));
 const token = Array.from(bytes, x => x.toString(16).padStart(2, "0")).join("");
 const { error } = await client.from("collaborator_sessions").insert({ profile_id: profile.id, token_hash: await sessionHash(token) });
 if (error) throw error;
 return token;
}
export async function readSession(client: any, token: unknown) {
 if (typeof token !== "string" || !/^[0-9a-f]{64}$/.test(token)) return null;
 const { data, error } = await client.from("collaborator_sessions").select("id,profile_id").eq("token_hash", await sessionHash(token)).is("revoked_at", null).maybeSingle();
 if (error) throw error;
 return data;
}
export async function revokeSession(client: any, id: string) {
 const { error } = await client.from("collaborator_sessions").update({ revoked_at: new Date().toISOString() }).eq("id", id);
 if (error) throw error;
}
