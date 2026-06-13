import React from 'react'
import { View, Text } from '@tarojs/components'
import classnames from 'classnames'
import styles from './index.module.scss'
import type { RefuelRecord } from '@/types'
import { formatFuelAmount } from '@/utils/fuelCalculator'

interface RefuelItemProps {
  record: RefuelRecord
  onClick?: () => void
}

const RefuelItem: React.FC<RefuelItemProps> = ({ record, onClick }) => {
  return (
    <View className={styles.refuelItem} onClick={onClick}>
      <View className={styles.itemHeader}>
        <View className={styles.portInfo}>
          <Text className={styles.portName}>{record.port}</Text>
          <Text className={styles.refuelTag}>加油</Text>
        </View>
        <Text className={styles.refuelDate}>{record.date}</Text>
      </View>

      <View className={styles.itemBody}>
        <View className={styles.infoColumn}>
          <View className={styles.infoRow}>
            <Text className={styles.infoLabel}>加油量</Text>
            <Text className={classnames(styles.infoValue, styles.quantity)}>
              {formatFuelAmount(record.quantity)} 吨
            </Text>
          </View>
          <View className={styles.infoRow}>
            <Text className={styles.infoLabel}>油品</Text>
            <Text className={styles.infoValue}>{record.fuelType}</Text>
          </View>
          <View className={styles.infoRow}>
            <Text className={styles.infoLabel}>供应商</Text>
            <Text className={styles.infoValue}>{record.supplier}</Text>
          </View>
        </View>

        <View className={styles.infoColumn}>
          <View className={styles.infoRow}>
            <Text className={styles.infoLabel}>单价</Text>
            <Text className={styles.infoValue}>¥{record.unitPrice.toLocaleString()}/吨</Text>
          </View>
          <View className={styles.infoRow}>
            <Text className={styles.infoLabel}>金额</Text>
            <Text className={classnames(styles.infoValue, styles.amount)}>
              ¥{record.totalAmount.toLocaleString()}
            </Text>
          </View>
          {record.receiptImage && (
            <View className={styles.infoRow}>
              <Text className={styles.infoLabel}>凭证</Text>
              <View className={styles.receiptIcon}>
                <Text>📷</Text>
              </View>
            </View>
          )}
        </View>
      </View>

      <View className={styles.itemFooter}>
        <Text className={styles.tankInfo}>加油舱: {record.tankName}</Text>
        <Text className={styles.operator}>录入人: {record.operator}</Text>
      </View>
    </View>
  )
}

export default RefuelItem
