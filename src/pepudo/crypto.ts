// End-to-end encryption between the host and each guest (ECDH P-256 + AES-GCM),
// so the public relay only ever sees scrambled dice. A player's id is derived
// from their public key, which stops anyone else from taking over their seat.

const b64 = (buf: ArrayBuffer | Uint8Array) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
};
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

const ECDH = { name: "ECDH", namedCurve: "P-256" };

export interface Identity {
  pid: string;
  pub: string;
  priv: CryptoKey;
}

export async function pidOf(pub: string): Promise<string> {
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", unb64(pub)));
  return "p-" + Array.from(hash.slice(0, 8), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Creates a key pair; with `storageKey` it is kept for this tab so a reload keeps your seat. */
export async function loadIdentity(storageKey?: string): Promise<Identity> {
  if (storageKey) {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
      if (saved?.pub && saved?.jwk) {
        const priv = await crypto.subtle.importKey("jwk", saved.jwk, ECDH, true, ["deriveKey"]);
        return { pid: await pidOf(saved.pub), pub: saved.pub, priv };
      }
    } catch {
      /* fall through to a fresh identity */
    }
  }
  const pair = await crypto.subtle.generateKey(ECDH, true, ["deriveKey"]);
  const pub = b64(await crypto.subtle.exportKey("raw", pair.publicKey));
  if (storageKey) {
    try {
      const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
      sessionStorage.setItem(storageKey, JSON.stringify({ pub, jwk }));
    } catch {
      /* private mode: identity just won't survive a reload */
    }
  }
  return { pid: await pidOf(pub), pub, priv: pair.privateKey };
}

export async function sharedKey(priv: CryptoKey, peerPub: string): Promise<CryptoKey> {
  const pub = await crypto.subtle.importKey("raw", unb64(peerPub), ECDH, false, []);
  return crypto.subtle.deriveKey({ name: "ECDH", public: pub }, priv, { name: "AES-GCM", length: 256 }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export interface Sealed {
  iv: string;
  d: string;
}

export async function seal(key: CryptoKey, body: unknown): Promise<Sealed> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(body));
  return { iv: b64(iv), d: b64(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data)) };
}

export async function unseal<T>(key: CryptoKey, m: Sealed): Promise<T> {
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(m.iv) }, key, unb64(m.d));
  return JSON.parse(new TextDecoder().decode(plain)) as T;
}
