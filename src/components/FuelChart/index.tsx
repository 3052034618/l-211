import React from 'react'
import { View, Text } from '@tarojs/components'
import classnames from 'classnames'
import styles from './index.module.scss'
import type { DailyConsumption } from '@/types'
import { formatFuelAmount } from '@/utils/fuelCalculator'

interface FuelChartProps {
  data: DailyConsumption[]
  title?: string
  subtitle?: string
}

interface ChartItem {
  label: string
  value: number
  refueled?: number
  type: 'normal' | 'warning' | 'danger' | 'refuel'
}

const FuelChart: React.FC<FuelChartProps> = ({ data, title = '油耗趋势', subtitle }) => {
  const maxValue = Math.max(...data.map(d => Math.max(d.consumed, d.refueled || 0)), 1)

  const chartData: ChartItem[] = data.map(d => {
    const avg = data.reduce((sum, item) => sum + item.consumed, 0) / data.length
    const deviation = (d.consumed - avg) / avg
    let type: ChartItem['type'] = 'normal'
    if (deviation > 0.3) type = 'danger'
    else if (deviation > 0.15) type = 'warning'

    return {
      label: d.date.slice(5),
      value: d.consumed,
      refueled: d.refueled,
      type
    }
  })

  return (
    <View className={styles.chartContainer}>
      <View className={styles.chartHeader}>
        <View>
          <Text className={styles.chartTitle}>{title}</Text>
          {subtitle && <Text className={styles.chartSubtitle}>{subtitle}</Text>}
        </View>
      </View>

      <View className={styles.chartBody}>
        {chartData.map((item, index) => (
          <View key={index} className={styles.chartRow}>
            <Text className={styles.chartLabel}>{item.label}</Text>
            <View className={styles.chartBarContainer}>
              <View
                className={classnames(styles.chartBar, styles[item.type])}
                style={{ width: `${(item.value / maxValue) * 100}%` }}
              />
              {item.refueled && item.refueled > 0 && (
                <View
                  className={classnames(styles.chartBar, styles.refuel)}
                  style={{
                    width: `${(item.refueled / maxValue) * 100}%`,
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    opacity: 0.6
                  }}
                />
              )}
            </View>
            <Text className={styles.chartValue}>{formatFuelAmount(item.value)}t</Text>
          </View>
        ))}
      </View>

      <View className={styles.chartFooter}>
        <View className={styles.legendItem}>
          <View className={styles.legendDot} style={{ background: '#26A69A' }} />
          <Text className={styles.legendText}>正常</Text>
        </View>
        <View className={styles.legendItem}>
          <View className={styles.legendDot} style={{ background: '#FF9800' }} />
          <Text className={styles.legendText}>偏高</Text>
        </View>
        <View className={styles.legendItem}>
          <View className={styles.legendDot} style={{ background: '#F44336' }} />
          <Text className={styles.legendText}>异常</Text>
        </View>
        <View className={styles.legendItem}>
          <View className={styles.legendDot} style={{ background: '#1E88E5' }} />
          <Text className={styles.legendText}>加油</Text>
        </View>
      </View>
    </View>
  )
}

export default FuelChart
