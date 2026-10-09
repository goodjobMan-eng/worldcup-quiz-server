import assert from "node:assert/strict";
const auth = "http://127.0.0.1:9099";
const accounts = await Promise.all(
  Array.from({ length: 41 }, async () => {
    const r = await fetch(
      auth + "/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnSecureToken: true }),
      },
    );
    assert.equal(r.status, 200);
    return r.json();
  }),
);
assert.equal(new Set(accounts.map((a) => a.localId)).size, 41);
const refreshed = await fetch(
  auth + "/securetoken.googleapis.com/v1/token?key=demo-key",
  {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: accounts[0].refreshToken,
    }),
  },
);
assert.equal(refreshed.status, 200);
assert.equal((await refreshed.json()).user_id, accounts[0].localId);
console.log(
  "PASS: 41 anonymous identities and same-identity token refresh on Firebase Auth emulator (no production project accessed)",
);
