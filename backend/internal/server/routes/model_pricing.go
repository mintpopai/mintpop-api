package routes

// 本文件为 fork（MintPop）新增：注册「批量查询模型定价」路由。
// 处理逻辑复用 h.Admin.Channel 上已注入的 billingService（见
// internal/handler/admin/model_pricing_query.go），此处仅做路由与鉴权接线。

import (
	"github.com/Wei-Shaw/sub2api/internal/handler"
	"github.com/Wei-Shaw/sub2api/internal/server/middleware"

	"github.com/gin-gonic/gin"
)

// RegisterModelPricingRoutes 注册模型定价查询路由（登录用户即可访问，供用户门户展示价格表）
func RegisterModelPricingRoutes(
	v1 *gin.RouterGroup,
	h *handler.Handlers,
	jwtAuth middleware.JWTAuthMiddleware,
) {
	pricing := v1.Group("/model-pricing")
	pricing.Use(gin.HandlerFunc(jwtAuth))
	{
		pricing.POST("/query", h.Admin.Channel.QueryModelPricing)
	}
}
