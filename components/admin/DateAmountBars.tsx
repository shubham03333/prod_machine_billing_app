'use client'

type Point = {
  key: string
  amount: number
  label: string
}

export default function DateAmountBars({
  points,
  maxAmount,
  barClass,
  formatAmount,
}: {
  points: Point[]
  maxAmount: number
  barClass: string
  formatAmount: (amount: number) => string
}) {
  return (
    <div className="w-full">
      <div className="flex items-end gap-0.5 min-h-[180px] w-full">
        {points.map((point) => {
          const height = maxAmount > 0 ? Math.max((point.amount / maxAmount) * 150, point.amount > 0 ? 4 : 0) : 0
          return (
            <div key={point.key} className="flex flex-col items-center flex-1 min-w-0">
              <div className="text-[10px] text-slate-500 h-4 leading-none">
                {point.amount > 0 ? `${Math.round(point.amount / 1000)}k` : ''}
              </div>
              <div
                className={`w-full max-w-[22px] rounded-t-md ${barClass}`}
                style={{ height: `${height}px` }}
                title={`${point.key}: ${formatAmount(point.amount)}`}
              />
              <div className="mt-1 text-[9px] leading-none text-slate-600">
                {point.label}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
