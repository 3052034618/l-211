import React from 'react'
import { View, Text, Button } from '@tarojs/components'
import classnames from 'classnames'
import styles from './index.module.scss'
import type { Tank } from '@/types'
import { calculateTankPercentage, formatFuelAmount } from '@/utils/fuelCalculator'

interface TankCardProps {
  tank: Tank
  onEdit?: () => void
  onClick?: () => void
}

const TankCard: React.FC<TankCardProps> = ({ tank, onEdit, onClick }) => {
  const percentage = calculateTankPercentage(tank.currentLevel, tank.maxLevel)
  const fuelColorClass = percentage > 70 ? 'normal' : percentage > 30 ? 'warning' : 'danger'

  return (
    <View className={styles.tankCard} onClick={onClick}>
      <View className={styles.cardHeader}>
        <Text className={styles.tankName}>{tank.name}</Text>
        <Text className={styles.fuelType}>{tank.fuelType}</Text>
      </View>

      <View className={styles.tankBody}>
        <View className={styles.tankVisual}>
          <View
            className={classnames(styles.fuelLevel, styles[fuelColorClass])}
            style={{ height: `${percentage}%` }}
          />
        </View>

        <View className={styles.tankInfo}>
          <View className={styles.levelRow}>
            <View>
              <Text className={styles.currentLevel}>{formatFuelAmount(tank.currentLevel)}</Text>
              <Text className={styles.levelUnit}>吨</Text>
            </View>
            <Text className={classnames(styles.percentage, styles[fuelColorClass])}>
              {percentage.toFixed(1)}%
            </Text>
          </View>

          <View className={styles.capacityRow}>
            <Text>容量: {tank.capacity} 吨</Text>
            <Text>安全存量: {(tank.maxLevel * 0.2).toFixed(0)} 吨</Text>
          </View>
        </View>
      </View>

      <View className={styles.lastUpdate}>
        <Text className={styles.updateLabel}>最后更新</Text>
        <Text className={styles.updateTime}>{tank.lastUpdate}</Text>
      </View>

      {onEdit && (
        <Button className={styles.editBtn} onClick={(e) => { e.stopPropagation(); onEdit() }}>
          录入存量
        </Button>
      )}
    </View>
  )
}

export default TankCard
