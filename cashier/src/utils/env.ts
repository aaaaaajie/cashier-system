export type PayEnv = 'wechat' | 'alipay' | 'browser';

export function detectPayEnv(ua: string = navigator.userAgent): PayEnv {
  const text = ua.toLowerCase();
  if (text.includes('micromessenger')) return 'wechat';
  if (text.includes('alipay')) return 'alipay';
  return 'browser';
}

