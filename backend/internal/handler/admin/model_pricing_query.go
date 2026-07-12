package admin

// 本文件为 fork（MintPop）新增，未改动上游任何文件：
// 通过在同包内给 ChannelHandler 追加方法，复用其已由 Wire 注入的 billingService，
// 实现「按模型名列表批量查询模型默认定价」的接口逻辑。

import (
	"strings"

	infraerrors "github.com/Wei-Shaw/sub2api/internal/pkg/errors"
	"github.com/Wei-Shaw/sub2api/internal/pkg/response"

	"github.com/gin-gonic/gin"
)

// queryModelPricingMaxModels 单次批量查询允许的最大模型数，防止恶意超大请求
const queryModelPricingMaxModels = 100

type queryModelPricingRequest struct {
	Models []string `json:"models"`
}

// modelPricingItem 单个模型的定价结果。
// 价格字段命名与 GetModelDefaultPricing 保持一致，单位均为 USD per token。
type modelPricingItem struct {
	Model            string  `json:"model"`
	Found            bool    `json:"found"`
	InputPrice       float64 `json:"input_price,omitempty"`
	OutputPrice      float64 `json:"output_price,omitempty"`
	CacheWritePrice  float64 `json:"cache_write_price,omitempty"`
	CacheReadPrice   float64 `json:"cache_read_price,omitempty"`
	ImageOutputPrice float64 `json:"image_output_price,omitempty"`
}

// QueryModelPricing 批量查询模型默认定价（数据源为 LiteLLM 定价目录 + 内置回退价）
// POST /api/v1/model-pricing/query  body: {"models": ["claude-opus-4-8", "gpt-4o"]}
func (h *ChannelHandler) QueryModelPricing(c *gin.Context) {
	var req queryModelPricingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.ErrorFrom(c, infraerrors.BadRequest("INVALID_REQUEST", "invalid request body: "+err.Error()))
		return
	}

	models := normalizeModelNames(req.Models)
	if len(models) == 0 {
		response.ErrorFrom(c, infraerrors.BadRequest("MISSING_PARAMETER", "models must contain at least one non-empty model name").
			WithMetadata(map[string]string{"param": "models"}))
		return
	}
	if len(models) > queryModelPricingMaxModels {
		response.ErrorFrom(c, infraerrors.BadRequest("TOO_MANY_MODELS", "models exceeds the maximum allowed count").
			WithMetadata(map[string]string{"param": "models"}))
		return
	}

	items := make([]modelPricingItem, 0, len(models))
	for _, model := range models {
		pricing, err := h.billingService.GetModelPricing(model)
		if err != nil || pricing == nil {
			// 模型不在定价目录中：标记 found=false，不视为整体失败
			items = append(items, modelPricingItem{Model: model, Found: false})
			continue
		}
		items = append(items, modelPricingItem{
			Model:            model,
			Found:            true,
			InputPrice:       pricing.InputPricePerToken,
			OutputPrice:      pricing.OutputPricePerToken,
			CacheWritePrice:  pricing.CacheCreationPricePerToken,
			CacheReadPrice:   pricing.CacheReadPricePerToken,
			ImageOutputPrice: pricing.ImageOutputPricePerToken,
		})
	}

	response.Success(c, gin.H{"pricings": items})
}

// normalizeModelNames 去除首尾空白、剔除空项并按首次出现顺序去重
func normalizeModelNames(models []string) []string {
	seen := make(map[string]struct{}, len(models))
	result := make([]string, 0, len(models))
	for _, m := range models {
		m = strings.TrimSpace(m)
		if m == "" {
			continue
		}
		if _, ok := seen[m]; ok {
			continue
		}
		seen[m] = struct{}{}
		result = append(result, m)
	}
	return result
}
