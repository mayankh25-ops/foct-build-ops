import { createHash, createHmac } from "node:crypto";

/**
 * Minimal AWS Signature Version 4 signer — just enough for SES v2 JSON calls
 * (POST/GET, no query strings, static credentials). Reference:
 * https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_sigv.html
 * Kept dependency-free on purpose: no AWS SDK anywhere in the tree.
 */
export interface SigV4Params {
  method: "GET" | "POST";
  host: string;
  path: string;
  region: string;
  service: string;
  accessKeyId: string;
  secretAccessKey: string;
  body: string;
  now?: Date;
}

const sha256Hex = (data: string) => createHash("sha256").update(data, "utf8").digest("hex");
const hmac = (key: Buffer | string, data: string) =>
  createHmac("sha256", key).update(data, "utf8").digest();

export function signV4(p: SigV4Params): Record<string, string> {
  const now = p.now ?? new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, ""); // 20260714T120000Z
  const dateStamp = amzDate.slice(0, 8);

  const payloadHash = sha256Hex(p.body);
  const canonicalHeaders =
    `content-type:application/json\n` + `host:${p.host}\n` + `x-amz-date:${amzDate}\n`;
  const signedHeaders = "content-type;host;x-amz-date";
  const canonicalRequest = [
    p.method,
    p.path,
    "", // no query string
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const scope = `${dateStamp}/${p.region}/${p.service}/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256Hex(canonicalRequest)].join("\n");

  const kDate = hmac(`AWS4${p.secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, p.region);
  const kService = hmac(kRegion, p.service);
  const kSigning = hmac(kService, "aws4_request");
  const signature = createHmac("sha256", kSigning).update(stringToSign, "utf8").digest("hex");

  return {
    "Content-Type": "application/json",
    "X-Amz-Date": amzDate,
    Authorization:
      `AWS4-HMAC-SHA256 Credential=${p.accessKeyId}/${scope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}
