import React from 'react'
import { View, Text } from '@tarojs/components'
import classnames from 'classnames'
import styles from './index.module.scss'
import { getSeverityLabel } from '@/utils/fuelCalculator'

interface AnomalyBadgeProps {
  severity: 'low' | 'medium' | 'high'
  isResolved?: boolean
}

const AnomalyBadge: React.FC<AnomalyBadgeProps> = ({ severity, isResolved }) => {
  const getIcon = () => {
    if (isResolved) return '✓'
    if (severity === 'high') return '!'
    if (severity === 'medium') return '⚠'
    return 'i'
  }

  return (
    <View className={classnames(
      styles.anomalyBadge,
      isResolved ? styles.resolved : styles[severity]
    )}>
      <Text className={styles.badgeIcon}>{getIcon()}</Text>
      <Text className={styles.badgeText}>
        {isResolved ? '已处理' : getSeverityLabel(severity)}
      </Text>
    </View>
  )
}

export default AnomalyBadge
