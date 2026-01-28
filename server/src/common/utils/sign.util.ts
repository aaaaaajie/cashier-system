import * as crypto from 'crypto';

export class SignUtil {
  private static normalizeValue(value: any): string {
    if (value === undefined || value === null) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (Array.isArray(value)) return JSON.stringify(value);
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  /**
   * Generate HMAC-SHA256 signature
   * 1. Sort params by key alphabetically
   * 2. Concatenate as key1=value1&key2=value2
   * 3. Append &timestamp={ts}&nonce={nonce}
   * 4. HMAC-SHA256 with appSecret
   */
  static generateSignature(
    params: Record<string, any>,
    timestamp: string,
    nonce: string,
    appSecret: string,
  ): string {
    const sortedKeys = Object.keys(params).sort();
    const parts = sortedKeys
      .filter((k) => params[k] !== undefined && params[k] !== null)
      .map((k) => `${k}=${SignUtil.normalizeValue(params[k])}`);
    parts.push(`timestamp=${timestamp}`);
    parts.push(`nonce=${nonce}`);
    const payload = parts.join('&');
    return crypto
      .createHmac('sha256', appSecret)
      .update(payload)
      .digest('hex');
  }

  static verifySignature(
    params: Record<string, any>,
    timestamp: string,
    nonce: string,
    appSecret: string,
    signature: string,
  ): boolean {
    const expected = SignUtil.generateSignature(params, timestamp, nonce, appSecret);
    const expectedBuf = Buffer.from(expected, 'hex');
    const sigBuf = Buffer.from(signature, 'hex');
    if (expectedBuf.length !== sigBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, sigBuf);
  }
}
