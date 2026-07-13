// 模型定价 —— 批量查询模型官方原价（后端数据源为 LiteLLM 定价目录）
import { apiClient } from './client'

/** 后端返回的单模型定价（价格单位：美元/token；未收录的模型 found=false 且无价格字段） */
export interface ModelPricingItem {
  model: string
  found: boolean
  input_price?: number
  output_price?: number
  cache_write_price?: number
  cache_read_price?: number
  image_output_price?: number
}

/** 页面使用的每百万 tokens 价格 */
export interface ModelPricePerMillion {
  input: number
  output: number
}

const PER_MILLION = 1_000_000

/**
 * 批量查询模型定价，返回 modelId → 美元/百万 tokens 的映射。
 * 未收录（found=false）或价格为 0 的模型不进入结果，由调用方回退到本地兜底价。
 */
export async function queryModelPricing(models: string[]): Promise<Map<string, ModelPricePerMillion>> {
  const { data } = await apiClient.post<{ pricings: ModelPricingItem[] }>('/model-pricing/query', {
    models
  })
  const result = new Map<string, ModelPricePerMillion>()
  for (const item of data.pricings ?? []) {
    if (!item.found || !item.input_price || !item.output_price) continue
    result.set(item.model, {
      input: item.input_price * PER_MILLION,
      output: item.output_price * PER_MILLION
    })
  }
  return result
}
