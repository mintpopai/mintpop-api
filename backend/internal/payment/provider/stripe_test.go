//go:build unit

package provider

import (
	"bytes"
	"context"
	"encoding/json"
	"testing"

	"github.com/Wei-Shaw/sub2api/internal/payment"
	"github.com/stretchr/testify/require"
	stripe "github.com/stripe/stripe-go/v85"
	"github.com/stripe/stripe-go/v85/webhook"
)

const stripeTestWebhookSecret = "whsec_test_secret"

// newTestStripe 构造测试用 Stripe 实例。
func newTestStripe(t *testing.T) *Stripe {
	t.Helper()
	prov, err := NewStripe("1", map[string]string{
		"secretKey":     "sk_test_123",
		"webhookSecret": stripeTestWebhookSecret,
	})
	require.NoError(t, err)
	return prov
}

// stripeSignedEvent 构造一条带合法签名的 payment_intent.succeeded 事件。
func stripeSignedEvent(t *testing.T, metadata map[string]string) (string, map[string]string) {
	t.Helper()
	object := map[string]any{
		"id":       "pi_test_1",
		"amount":   1000,
		"currency": "cny",
		"metadata": metadata,
	}
	objectRaw, err := json.Marshal(object)
	require.NoError(t, err)
	event := map[string]any{
		"id":          "evt_test_1",
		"object":      "event",
		"type":        "payment_intent.succeeded",
		"api_version": stripe.APIVersion,
		"data":        map[string]any{"object": json.RawMessage(objectRaw)},
	}
	payload, err := json.Marshal(event)
	require.NoError(t, err)
	signed := webhook.GenerateTestSignedPayload(&webhook.UnsignedPayload{
		Payload: payload,
		Secret:  stripeTestWebhookSecret,
	})
	return string(payload), map[string]string{"stripe-signature": signed.Header}
}

func TestStripeVerifyNotificationClaimsByProductMetadata(t *testing.T) {
	t.Parallel()

	t.Run("own product event is processed", func(t *testing.T) {
		t.Parallel()
		prov := newTestStripe(t)
		raw, headers := stripeSignedEvent(t, map[string]string{"orderId": "mintpopapi_1", "product": "api"})
		n, err := prov.VerifyNotification(context.Background(), raw, headers)
		require.NoError(t, err)
		require.NotNil(t, n)
		require.Equal(t, "mintpopapi_1", n.OrderID)
	})

	t.Run("foreign product event is silently skipped", func(t *testing.T) {
		t.Parallel()
		prov := newTestStripe(t)
		raw, headers := stripeSignedEvent(t, map[string]string{"orderId": "mintpopshop_1", "product": "shop"})
		n, err := prov.VerifyNotification(context.Background(), raw, headers)
		require.NoError(t, err)
		require.Nil(t, n)
	})

	t.Run("untagged event falls through to order lookup", func(t *testing.T) {
		t.Parallel()
		prov := newTestStripe(t)
		raw, headers := stripeSignedEvent(t, map[string]string{"orderId": "mintpopapi_2"})
		n, err := prov.VerifyNotification(context.Background(), raw, headers)
		require.NoError(t, err)
		require.NotNil(t, n)
		require.Equal(t, "mintpopapi_2", n.OrderID)
	})
}

func TestStripeBuildPaymentIntentParamsTagsProductAndDescriptor(t *testing.T) {
	t.Parallel()

	prov := newTestStripe(t)
	params, err := prov.buildPaymentIntentParams(payment.CreatePaymentRequest{
		OrderID: "mintpopapi_3",
		Amount:  "10.00",
		Subject: "test subject",
	})
	require.NoError(t, err)
	require.Equal(t, "mintpopapi_3", params.Metadata["orderId"])
	require.Equal(t, "api", params.Metadata["product"])
	require.NotNil(t, params.StatementDescriptorSuffix)
	require.Equal(t, "API", *params.StatementDescriptorSuffix)
}

type stripeRefundBackend struct {
	params []*stripe.RefundCreateParams
}

func (b *stripeRefundBackend) Call(_ string, _ string, _ string, params stripe.ParamsContainer, v stripe.LastResponseSetter) error {
	b.params = append(b.params, params.(*stripe.RefundCreateParams))
	refund := v.(*stripe.Refund)
	refund.ID = "re_123"
	refund.Status = stripe.RefundStatusSucceeded
	return nil
}

func (*stripeRefundBackend) CallStreaming(string, string, string, stripe.ParamsContainer, stripe.StreamingLastResponseSetter) error {
	return nil
}

func (*stripeRefundBackend) CallRaw(string, string, string, []byte, *stripe.Params, stripe.LastResponseSetter) error {
	return nil
}

func (*stripeRefundBackend) CallMultipart(string, string, string, string, *bytes.Buffer, *stripe.Params, stripe.LastResponseSetter) error {
	return nil
}

func (*stripeRefundBackend) SetMaxNetworkRetries(int64) {}

func TestStripeRefundUsesStableAmountSpecificIdempotencyKey(t *testing.T) {
	backend := &stripeRefundBackend{}
	client := stripe.NewClient("sk_test", stripe.WithBackends(&stripe.Backends{API: backend}))
	provider := &Stripe{
		config:      map[string]string{"currency": "CNY"},
		initialized: true,
		sc:          client,
	}

	refund := func(amount string) {
		_, err := provider.Refund(context.Background(), payment.RefundRequest{
			TradeNo: "pi_123",
			OrderID: "sub2_order_456",
			Amount:  amount,
		})
		require.NoError(t, err)
	}

	refund("12.34")
	refund("12.34")
	refund("12.35")

	require.Len(t, backend.params, 3)
	require.Equal(t, int64(1234), *backend.params[0].Amount)
	require.Equal(t, "re-sub2_order_456-1234", *backend.params[0].IdempotencyKey)
	require.Equal(t, backend.params[0].IdempotencyKey, backend.params[1].IdempotencyKey)
	require.Equal(t, int64(1235), *backend.params[2].Amount)
	require.Equal(t, "re-sub2_order_456-1235", *backend.params[2].IdempotencyKey)
	require.NotEqual(t, *backend.params[0].IdempotencyKey, *backend.params[2].IdempotencyKey)
}
