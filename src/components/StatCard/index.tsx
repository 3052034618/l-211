import React from 'react'
import { View, Text } from '@tarojs/components'
import classnames from 'classnames'
import styles from './index.module.scss'
import type { StatCardData } from '@/types'

interface StatCardProps extends StatCardData {
  icon?: string
  onClick?: () => void
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  unit,
  trend,
  trendValue,
  color = '#1E88E5',
  icon,
  onClick
}) => {
  const getTrendIcon = () => {
    if (trend === 'up') return '↑'
    if (trend === 'down') return '↓'
    return '→'
  }

  return (
    <View className={styles.statCard} onClick={onClick}>
      <View className={styles.cardHeader}>
        <Text className={styles.cardTitle}>{title}</Text>
        {icon && (
          <View className={styles.cardIcon} style={{ background: color }}>
            <Text>{icon}</Text>
          </View>
        )}
      </View>
      <View className={styles.cardValue}>
        <Text>{value}</Text>
        {unit && <Text className={styles.cardUnit}>{unit}</Text>}
      </View>
      {trend && trendValue !== undefined && (
        <View className={classnames(styles.cardTrend, styles[trend])}>
          <Text className={styles.trendIcon}>{getTrendIcon()}</Text>
          <Text>{trendValue}%</Text>
        </View>
      )}
    </View>
  )
}

export default StatCard
