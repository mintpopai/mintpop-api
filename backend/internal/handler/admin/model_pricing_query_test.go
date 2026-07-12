//go:build unit

package admin

// 本文件为 fork（MintPop）新增：QueryModelPricing 批量查询模型定价接口的单元测试。

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Wei-Shaw/sub2api/internal/config"
	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

// newPricingQueryTestHandler 构造仅含 billingService（走硬编码回退价）的 handler
func newPricingQueryTestHandler() *ChannelHandler {
	return NewChannelHandler(nil, service.NewBillingService(&config.Config{}, nil), nil)
}

func performQueryModelPricing(t *testing.T, body string) *httptest.ResponseRecorder {
	t.Helper()
	gin.SetMode(gin.TestMode)
	r := gin.New()
	h := newPricingQueryTestHandler()
	r.POST("/model-pricing/query", h.QueryModelPricing)

	req := httptest.NewRequest(http.MethodPost, "/model-pricing/query", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

type queryPricingEnvelope struct {
	Code int `json:"code"`
	Data struct {
		Pricings []modelPricingItem `json:"pricings"`
	} `json:"data"`
	Message string `json:"message"`
}

func TestQueryModelPricing_FoundAndNotFound(t *testing.T) {
	// claude-opus-4.5 命中内置回退价；不存在的模型返回 found=false
	w := performQueryModelPricing(t, `{"models": ["claude-opus-4.5", "no-such-model-xyz"]}`)
	require.Equal(t, http.StatusOK, w.Code)

	var resp queryPricingEnvelope
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	require.Equal(t, 0, resp.Code)
	require.Len(t, resp.Data.Pricings, 2)

	opus := resp.Data.Pricings[0]
	require.Equal(t, "claude-opus-4.5", opus.Model)
	require.True(t, opus.Found)
	require.InDelta(t, 5e-6, opus.InputPrice, 1e-12)
	require.InDelta(t, 25e-6, opus.OutputPrice, 1e-12)

	missing := resp.Data.Pricings[1]
	require.Equal(t, "no-such-model-xyz", missing.Model)
	require.False(t, missing.Found)
}

func TestQueryModelPricing_DedupAndTrim(t *testing.T) {
	// 空白项被剔除，重复项按首次出现顺序去重
	w := performQueryModelPricing(t, `{"models": ["  claude-opus-4.5  ", "claude-opus-4.5", "", "   "]}`)
	require.Equal(t, http.StatusOK, w.Code)

	var resp queryPricingEnvelope
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	require.Len(t, resp.Data.Pricings, 1)
	require.Equal(t, "claude-opus-4.5", resp.Data.Pricings[0].Model)
}

func TestQueryModelPricing_EmptyList(t *testing.T) {
	for _, body := range []string{`{"models": []}`, `{"models": ["", "  "]}`, `{}`} {
		w := performQueryModelPricing(t, body)
		require.Equal(t, http.StatusBadRequest, w.Code, "body=%s", body)
		var resp queryPricingEnvelope
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp), "body=%s", body)
		require.NotEqual(t, 0, resp.Code, "body=%s", body)
	}
}

func TestQueryModelPricing_InvalidBody(t *testing.T) {
	w := performQueryModelPricing(t, `{"models": "not-a-list"}`)
	require.Equal(t, http.StatusBadRequest, w.Code)
	var resp queryPricingEnvelope
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	require.NotEqual(t, 0, resp.Code)
}

func TestQueryModelPricing_TooManyModels(t *testing.T) {
	models := make([]string, 0, queryModelPricingMaxModels+1)
	for i := 0; i <= queryModelPricingMaxModels; i++ {
		models = append(models, fmt.Sprintf("model-%d", i))
	}
	body, err := json.Marshal(map[string]any{"models": models})
	require.NoError(t, err)

	w := performQueryModelPricing(t, string(body))
	require.Equal(t, http.StatusBadRequest, w.Code)
	var resp queryPricingEnvelope
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	require.NotEqual(t, 0, resp.Code)
}

func TestNormalizeModelNames(t *testing.T) {
	got := normalizeModelNames([]string{" a ", "b", "a", "", "  ", "b"})
	require.Equal(t, []string{"a", "b"}, got)
}
