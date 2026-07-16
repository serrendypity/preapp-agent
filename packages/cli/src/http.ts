// HTTP 客户端：Node 内置 fetch。publish 网络错误 / 503 用同一 Idempotency-Key 自动重试。

export interface HttpResponse {
  status: number;
  bodyText: string;
}

export interface HttpError extends Error {
  cause?: unknown;
}

const MAX_RETRIES = 2;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** 网络异常或 503 时重试（同 Idempotency-Key）；4xx/2xx 不重试。 */
export async function postPublish(
  url: string,
  token: string,
  form: FormData,
  idempotencyKey: string,
): Promise<HttpResponse> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "idempotency-key": idempotencyKey,
        },
        body: form,
      });
      const bodyText = await res.text();
      if (res.status === 503 && attempt < MAX_RETRIES) {
        await sleep(250 * (attempt + 1));
        continue;
      }
      return { status: res.status, bodyText };
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_RETRIES) {
        await sleep(250 * (attempt + 1));
        continue;
      }
    }
  }
  const e = new Error(
    `network error after ${MAX_RETRIES + 1} attempts: ${String(lastErr)}`,
  ) as HttpError;
  e.cause = lastErr;
  throw e;
}

export async function getJson(url: string, token: string): Promise<HttpResponse> {
  const res = await fetch(url, {
    method: "GET",
    headers: { authorization: `Bearer ${token}` },
  });
  return { status: res.status, bodyText: await res.text() };
}

/** revision brief upsert（prototype-prd §15.4）。无重试：CAS 语义下盲重试可能撞 409，交给上层决策。 */
export async function putJson(url: string, token: string, body: unknown): Promise<HttpResponse> {
  const res = await fetch(url, {
    method: "PUT",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, bodyText: await res.text() };
}
