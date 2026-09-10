import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Resend Webhook Hard-Bounce Feedback Logic (SIGNUP_VERIFICATION_PLAN.md §4.9)', () => {
  function evaluateBounceFeedback(kind: string, bouncePayload: { bounce_type?: string; type?: string }) {
    const bounceType = String(
      bouncePayload.bounce_type || bouncePayload.type || ''
    ).toLowerCase();

    const isHardBounce =
      bounceType.includes('permanent') ||
      bounceType.includes('hard') ||
      (!bounceType.includes('transient') && !bounceType.includes('soft'));

    return kind === 'EMAIL_VERIFICATION' && isHardBounce;
  }

  test('marks user as bounced for hard bounce on EMAIL_VERIFICATION', () => {
    assert.equal(evaluateBounceFeedback('EMAIL_VERIFICATION', { bounce_type: 'Permanent' }), true);
    assert.equal(evaluateBounceFeedback('EMAIL_VERIFICATION', { bounce_type: 'hard' }), true);
    assert.equal(evaluateBounceFeedback('EMAIL_VERIFICATION', { type: 'hard_bounce' }), true);
    assert.equal(evaluateBounceFeedback('EMAIL_VERIFICATION', {}), true);
  });

  test('does NOT mark user as bounced for soft/transient bounces', () => {
    assert.equal(evaluateBounceFeedback('EMAIL_VERIFICATION', { bounce_type: 'Transient' }), false);
    assert.equal(evaluateBounceFeedback('EMAIL_VERIFICATION', { bounce_type: 'soft' }), false);
    assert.equal(evaluateBounceFeedback('EMAIL_VERIFICATION', { type: 'soft_bounce' }), false);
  });

  test('does NOT mark user as bounced when kind is not EMAIL_VERIFICATION', () => {
    assert.equal(evaluateBounceFeedback('QUOTATION_SENT', { bounce_type: 'Permanent' }), false);
    assert.equal(evaluateBounceFeedback('PASSWORD_RESET', { bounce_type: 'Permanent' }), false);
  });
});
