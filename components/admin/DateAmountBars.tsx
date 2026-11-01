'use client'

type Point = {
  key: string
  amount: number
  label: string
}

function labelStep(count: number) {
  if (count <= 10) return 1
  if (count <= 18) return 2
  if (count <= 31) return 3
  if (count <= 50) return 5
  return 7
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
  const step = labelStep(points.length)
  const last = points.length - 1

  return (
    <div className="w-full pb-1">
      <div className="flex items-end gap-0.5 sm:gap-1 min-h-[180px] w-full">
        {points.map((point, index) => {
          const height = maxAmount > 0 ? Math.max((point.amount / maxAmount) * 150, point.amount > 0 ? 4 : 0) : 0
          const showLabel = index === 0 || index === last || index % step === 0
          return (
            <div key={point.key} className="flex flex-col items-center flex-1 min-w-0">
              <div className="text-[10px] text-slate-500 h-4 leading-none">
                {point.amount > 0 ? `${Math.round(point.amount / 1000)}k` : ''}
              </div>
              <div
                className={`w-full max-w-[22px] rounded-t-md ${barClass}`}
                style={{ height: `${height}px` }}
                title={`${point.label}: ${formatAmount(point.amount)}`}
              />
              <div className="h-11 relative w-full">
                {showLabel && (
                  <span className="absolute left-1/2 top-1.5 text-[10px] text-slate-600 whitespace-nowrap origin-top-left -rotate-45">
                    {point.label}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
