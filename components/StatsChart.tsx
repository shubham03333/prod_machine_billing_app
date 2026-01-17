import React from 'react'

interface StatsData {
  totalRevenue: number
  totalRentals: number
  machineStats: Record<string, number>
  operatorStats: Record<string, number>
}

interface StatsChartProps {
  stats: StatsData
}

export const StatsChart: React.FC<StatsChartProps> = ({ stats }) => {
  const maxValue = Math.max(
    ...Object.values(stats.machineStats),
    ...Object.values(stats.operatorStats)
  )

  const renderBar = (label: string, value: number, color: string) => {
    const height = maxValue > 0 ? (value / maxValue) * 200 : 0
    return (
      <div key={label} className="flex flex-col items-center">
        <div className="text-xs font-medium mb-1">{value.toLocaleString()}</div>
        <div className="w-8 bg-gray-200 rounded-t" style={{ height: `${200 - height}px` }}></div>
        <div
          className={`w-8 rounded-b ${color}`}
          style={{ height: `${height}px` }}
        ></div>
        <div className="text-xs mt-1 text-center max-w-16 truncate" title={label}>
          {label}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Statistics Overview</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">
            ₹{stats.totalRevenue.toLocaleString()}
          </div>
          <div className="text-sm text-gray-600">Total Revenue</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">
            {stats.totalRentals}
          </div>
          <div className="text-sm text-gray-600">Total Rentals</div>
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <h4 className="text-md font-medium mb-3">Revenue by Machine Type</h4>
          <div className="flex items-end justify-center space-x-4 h-64">
            {Object.entries(stats.machineStats).map(([machine, revenue]) =>
              renderBar(machine, revenue, 'bg-blue-500')
            )}
          </div>
        </div>

        <div>
          <h4 className="text-md font-medium mb-3">Revenue by Operator</h4>
          <div className="flex items-end justify-center space-x-4 h-64">
            {Object.entries(stats.operatorStats).map(([operator, revenue]) =>
              renderBar(operator, revenue, 'bg-green-500')
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
