import React, { useState } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro, { useRouter, useDidShow } from '@tarojs/taro'
import styles from './index.module.scss'
import { useVoyageStore } from '@/store/useVoyageStore'
import { mockRefuelRecords } from '@/data/mockData'
import type { RefuelRecord } from '@/types'
import dayjs from 'dayjs'

const RefuelDetailPage: React.FC = () => {
  const router = useRouter()
  const { currentVoyage } = useVoyageStore()
  const [record, setRecord] = useState<RefuelRecord | null>(null)

  useDidShow(() => {
    const recordId = router.params.id
    if (recordId && currentVoyage) {
      const found = currentVoyage.refuelRecords.find(r => r.id === recordId)
      if (found) {
        setRecord(found)
      } else {
        const mockFound = mockRefuelRecords.find(r => r.id === recordId)
        if (mockFound) setRecord(mockFound)
      }
    }
    if (!record) {
      setRecord(mockRefuelRecords[0])
    }
  })

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY',
      minimumFractionDigits: 0
    }).format(amount)
  }

  const handlePreviewImage = () => {
    if (record?.receiptImage) {
      Taro.previewImage({
        urls: [record.receiptImage]
      })
    } else {
      Taro.showToast({ title: '暂无凭证图片', icon: 'none' })
    }
  }

  if (!record) {
    return (
      <View className={styles.page}>
        <View style={{ padding: 100, textAlign: 'center' }}>
          <Text>加载中...</Text>
        </View>
      </View>
    )
  }

  return (
    <ScrollView className={styles.page} scrollY>
      <View className={styles.headerCard}>
        <Text className={styles.portLabel}>加油港口</Text>
        <Text className={styles.portName}>{record.port}</Text>
        <View className={styles.amountRow}>
          <Text className={styles.amount}>{record.quantity.toFixed(2)}</Text>
          <Text className={styles.unit}>吨</Text>
        </View>
        <Text className={styles.totalAmount}>合计金额：{formatCurrency(record.totalAmount)}</Text>
        <View className={styles.badge}>
          <Text>{record.fuelType} · {record.tankName}</Text>
        </View>
      </View>

      <View className={styles.sectionCard}>
        <View className={styles.sectionTitle}>
          <Text className={styles.icon}>📋</Text>
          <Text>基本信息</Text>
        </View>
        <View className={styles.infoRow}>
          <Text className={styles.label}>加油日期</Text>
          <Text className={styles.value}>{dayjs(record.date).format('YYYY-MM-DD')}</Text>
        </View>
        <View className={styles.infoRow}>
          <Text className={styles.label}>燃料类型</Text>
          <Text className={`${styles.value} ${styles.highlight}`}>{record.fuelType}</Text>
        </View>
        <View className={styles.infoRow}>
          <Text className={styles.label}>受油舱</Text>
          <Text className={styles.value}>{record.tankName}</Text>
        </View>
        <View className={styles.infoRow}>
          <Text className={styles.label}>供应商</Text>
          <Text className={styles.value}>{record.supplier}</Text>
        </View>
        <View className={styles.infoRow}>
          <Text className={styles.label}>单价</Text>
          <Text className={styles.value}>¥{record.unitPrice.toLocaleString()} 元/吨</Text>
        </View>
        <View className={styles.infoRow}>
          <Text className={styles.label}>加油数量</Text>
          <Text className={`${styles.value} ${styles.highlight}`}>{record.quantity.toFixed(2)} 吨</Text>
        </View>
        <View className={styles.infoRow}>
          <Text className={styles.label}>总金额</Text>
          <Text className={`${styles.value} ${styles.highlight}`}>{formatCurrency(record.totalAmount)}</Text>
        </View>
      </View>

      <View className={styles.sectionCard}>
        <View className={styles.sectionTitle}>
          <Text className={styles.icon}>👤</Text>
          <Text>操作信息</Text>
        </View>
        <View className={styles.infoRow}>
          <Text className={styles.label}>操作员</Text>
          <Text className={styles.value}>{record.operator}</Text>
        </View>
        <View className={styles.infoRow}>
          <Text className={styles.label}>记录时间</Text>
          <Text className={styles.value}>{dayjs(record.createdAt).format('YYYY-MM-DD HH:mm:ss')}</Text>
        </View>
        <View className={styles.infoRow}>
          <Text className={styles.label}>所属航次</Text>
          <Text className={styles.value}>{currentVoyage?.fromPort || '--'} → {currentVoyage?.toPort || '--'}</Text>
        </View>
      </View>

      <View className={styles.receiptSection}>
        <View className={styles.sectionTitle}>
          <Text className={styles.icon}>📷</Text>
          <Text>加油凭证</Text>
        </View>
        <View className={styles.receiptImage} onClick={handlePreviewImage}>
          {record.receiptImage ? (
            <Image className={styles.hasImage} src={record.receiptImage} mode='aspectFill' />
          ) : (
            <View className={styles.placeholder}>
              <Text className={styles.icon}>🧾</Text>
              <Text className={styles.text}>点击查看凭证</Text>
            </View>
          )}
        </View>
        <Text className={styles.imageHint}>
          {record.receiptImage ? '点击图片可放大查看' : '暂无凭证照片'}
        </Text>
      </View>

      <View className={styles.remarksSection}>
        <View className={styles.sectionTitle}>
          <Text className={styles.icon}>📝</Text>
          <Text>备注信息</Text>
        </View>
        <View className={styles.remarksContent}>
          <Text className={record.remarks ? '' : styles.emptyRemarks}>
            {record.remarks || '暂无备注信息'}
          </Text>
        </View>
      </View>

      <View style={{ height: 160 }} />
    </ScrollView>
  )
}

export default RefuelDetailPage
