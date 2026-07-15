//go:build unit

package provider

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/Wei-Shaw/sub2api/internal/payment"
	stripe "github.com/stripe/stripe-go/v85"
	"github.com/stripe/stripe-go/v85/webhook"
	"github.com/stretchr/testify/require"
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
