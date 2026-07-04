/**
 * WAI-ARIA Authoring Practices 的 Radio Group 键盘模式：
 * →/↓ 移动到组内下一项并选中，←/↑ 移动到上一项并选中，越界时首尾回绕（循环）。
 * 抽成纯函数，便于独立单测；组件侧只负责用返回的下标去 focus + 选中对应项。
 */

/** 按方向键计算下一个应聚焦/选中的下标；非方向键或空组返回 null（调用方不处理） */
export function nextRadioIndex(current: number, length: number, key: string): number | null {
  if (length <= 0) return null
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return (current + 1) % length
    case 'ArrowLeft':
    case 'ArrowUp':
      return (current - 1 + length) % length
    default:
      return null
  }
}
