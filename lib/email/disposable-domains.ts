/**
 * Static disposable email provider blocklist (SIGNUP_VERIFICATION_PLAN.md §4.1 Gate 2).
 * Covers the most prevalent throwaway email services.
 */
export const DISPOSABLE_DOMAINS: ReadonlySet<string> = new Set([
  '0-mail.com',
  '10minutemail.be',
  '10minutemail.cf',
  '10minutemail.co.uk',
  '10minutemail.co.za',
  '10minutemail.com',
  '10minutemail.de',
  '10minutemail.net',
  '10minutemail.org',
  '10minutemailbox.com',
  '10minutemails.in',
  '20minutemail.com',
  '2prong.com',
  'burnermail.io',
  'chacuo.net',
  'crazymailing.com',
  'deadaddress.com',
  'despam.it',
  'disposablemail.com',
  'disposeamail.com',
  'dispostable.com',
  'dropmail.me',
  'emailfake.com',
  'emailondeck.com',
  'emailtemporanea.com',
  'emailtemporal.org',
  'fakemailgenerator.com',
  'fastmail.fm',
  'filzmail.com',
  'fleckens.hu',
  'generator.email',
  'getairmail.com',
  'getnada.com',
  'grr.la',
  'guerrillamail.biz',
  'guerrillamail.block',
  'guerrillamail.com',
  'guerrillamail.de',
  'guerrillamail.net',
  'guerrillamail.org',
  'guerrillamailblock.com',
  'harakirimail.com',
  'inboxbear.com',
  'incognitomail.org',
  'jetable.org',
  'kasmail.com',
  'maildrop.cc',
  'mailinator.com',
  'mailinator.net',
  'mailinator2.com',
  'mailnesia.com',
  'mailnull.com',
  'mohmal.com',
  'mytemp.email',
  'nada.ltd',
  'nada.post',
  'sharklasers.com',
  'spam4.me',
  'spambog.com',
  'spambox.us',
  'spamgourmet.com',
  'superrito.com',
  'temp-mail.org',
  'tempail.com',
  'tempinbox.com',
  'tempmail.com',
  'tempmail.net',
  'tempmailaddress.com',
  'throwawaymail.com',
  'trashmail.com',
  'trashmail.de',
  'trashmail.net',
  'yopmail.com',
  'yopmail.fr',
  'yopmail.net',
]);

/**
 * Checks if an email address or domain belongs to a known disposable domain.
 */
export function isDisposableDomain(emailOrDomain: string): boolean {
  if (!emailOrDomain || typeof emailOrDomain !== 'string') {
    return false;
  }

  const trimmed = emailOrDomain.trim().toLowerCase();
  const domain = trimmed.includes('@')
    ? trimmed.split('@').pop() || ''
    : trimmed;

  return DISPOSABLE_DOMAINS.has(domain);
}
