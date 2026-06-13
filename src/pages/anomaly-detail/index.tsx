import React, { useState } from 'react'
import { View, Text, ScrollView, Button, Textarea } from '@tarojs/components'
import Taro, { useRouter, useDidShow } from '@tarojs/taro'
import styles from './index.module.scss'
import { useVoyageStore } from '@/store/useVoyageStore'
import { mockAnomalyRecords, mockUser } from '@/data/mockData'
import type { AnomalyRecord, Voyage } from '@/types'
import dayjs from 'dayjs'

const AnomalyDetailPage: React.FC = () => {
  const router = useRouter()
  const { getAnomalyRecordById, resolveAnomaly, user, setUser, loadData } = useVoyageStore()
  const [anomaly, setAnomaly] = useState<AnomalyRecord | null>(null)
  const [voyage, setVoyage] = useState<Voyage | null>(null)
  const [resolution, setResolution] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useDidShow(async () => {
    await loadData()
    if (!user) setUser(mockUser)

    const anomalyId = router.params.id
    if (anomalyId) {
      const { record: foundAnomaly, voyage: foundVoyage } = getAnomalyRecordById(anomalyId)
      if (foundAnomaly) {
        setAnomaly(foundAnomaly)
        setVoyage(foundVoyage || null)
      } else {
        const mockFound = mockAnomalyRecords.find(a => a.id === anomalyId)
        if (mockFound) setAnomaly(mockFound)
      }
    }
    if (!anomaly && !router.params.id) {
      setAnomaly(mockAnomalyRecords[1])
    }
  })

  const getSeverityText = (severity: string) => {
    const map: Record<string, string> = {
      low: '轻微异常',
      medium: '中度异常',
      high: '严重异常'
    }
    return map[severity] || '未知'
  }

  const getTypeText = (type: string) => {
    const map: Record<string, string> = {
      consumption: '油耗异常',
      tank_level: '油舱存量异常',
      engine: '主机运行异常'
    }
    return map[type] || '未知类型'
  }

  const getHeaderClass = () => {
    if (!anomaly) return styles.low
    if (anomaly.isResolved) return styles.resolved
    return styles[anomaly.severity]
  }

  const getBarWidth = () => {
    if (!anomaly) return { expected: '50%', actual: '70%', marker: '50%' }
    const maxValue = Math.max(anomaly.expectedValue, anomaly.actualValue) * 1.2
    const expectedWidth = (anomaly.expectedValue / maxValue) * 100
    const actualWidth = (anomaly.actualValue / maxValue) * 100
    return {
      expected: `${expectedWidth}%`,
      actual: `${actualWidth}%`,
      marker: `${expectedWidth}%`
    }
  }

  const handleResolve = async () => {
    if (!anomaly || !user) return
    if (!resolution.trim()) {
      Taro.showToast({ title: '请填写处理说明', icon: 'none' })
      return
    }

    setIsSubmitting(true)
    try {
      resolveAnomaly(anomaly.id, resolution.trim(), user.name)
      setAnomaly(prev => prev ? {
        ...prev,
        isResolved: true,
        resolution: resolution.trim(),
        resolvedBy: user.name,
        resolvedAt: dayjs().format('YYYY-MM-DD HH:mm:ss')
      } : null)

      Taro.showModal({
        title: '处理成功',
        content: '异常已标记为已处理，是否返回上一页？',
        success: (res) => {
          if (res.confirm) {
            Taro.navigateBack()
          }
        }
      })
    } catch (error) {
      console.error('[AnomalyDetail] 处理失败', error)
      Taro.showToast({ title: '处理失败，请重试', icon: 'none' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleIgnore = () => {
    Taro.showModal({
      title: '忽略异常',
      content: '确定要忽略此异常吗？忽略后仍可在异常记录中查看。',
      confirmText: '确定忽略',
      confirmColor: '#FF9800',
      success: (res) => {
        if (res.confirm) {
          Taro.showToast({ title: '已忽略', icon: 'success' })
          setTimeout(() => Taro.navigateBack(), 1000)
        }
      }
    })
  }

  if (!anomaly) {
    return (
      <View className={styles.page}>
        <View style={{ padding: 100, textAlign: 'center' }}>
          <Text>加载中...</Text>
        </View>
      </View>
    )
  }

  const barWidth = getBarWidth()
  const unit = anomaly.type === 'consumption' ? '吨/天' : anomaly.type === 'tank_level' ? '吨' : '小时'

  return (
    <ScrollView className={styles.page} scrollY>
      <View className={`${styles.headerCard} ${getHeaderClass()}`}>
        <View className={styles.severityBadge}>
          <Text>{anomaly.isResolved ? '已处理' : getSeverityText(anomaly.severity)}</Text>
        </View>
        <Text className={styles.description}>{anomaly.description}</Text>
        <Text className={styles.date}>
          {getTypeText(anomaly.type)} · {dayjs(anomaly.date).format('YYYY-MM-DD HH:mm')}
        </Text>
        <View className={styles.deviation}>
          <Text className={styles.deviationValue}>+{anomaly.deviation.toFixed(1)}%</Text>
          <Text className={styles.deviationLabel}>超出正常值</Text>
        </View>
      </View>

      <View className={styles.comparisonSection}>
        <View className={styles.sectionTitle}>
          <Text className={styles.icon}>📊</Text>
          <Text>数值对比</Text>
        </View>
        <View className={styles.comparisonBar}>
          <View className={styles.barItem}>
            <Text className={`${styles.barValue} ${styles.expected}`}>{anomaly.expectedValue.toFixed(2)}</Text>
            <Text className={styles.barLabel}>正常值</Text>
            <Text className={styles.barUnit}>{unit}</Text>
          </View>
          <Text className={styles.barArrow}>→</Text>
          <View className={styles.barItem}>
            <Text className={`${styles.barValue} ${styles.actual}`}>{anomaly.actualValue.toFixed(2)}</Text>
            <Text className={styles.barLabel}>实际值</Text>
            <Text className={styles.barUnit}>{unit}</Text>
          </View>
        </View>
        <View className={styles.barVisual}>
          <View className={styles.barFillExpected} style={{ width: barWidth.expected }} />
          <View className={styles.barFillActual} style={{ width: barWidth.actual }} />
          <View className={styles.markerLine} style={{ left: barWidth.marker }} />
        </View>
        <View className={styles.barLabels}>
          <Text className={styles.barLabel}>正常值位置 ↑</Text>
          <Text className={styles.barLabel}>偏差 {anomaly.deviation.toFixed(1)}%</Text>
        </View>
      </View>

      <View className={styles.sectionCard}>
        <View className={styles.sectionTitle}>
          <Text className={styles.icon}>ℹ️</Text>
          <Text>详细信息</Text>
        </View>
        <View className={styles.infoRow}>
          <Text className={styles.label}>异常类型</Text>
          <Text className={styles.value}>{getTypeText(anomaly.type)}</Text>
        </View>
        <View className={styles.infoRow}>
          <Text className={styles.label}>异常等级</Text>
          <Text className={`${styles.value} ${anomaly.severity === 'high' ? styles.danger : anomaly.severity === 'medium' ? styles.danger : styles.value}`}>
            {getSeverityText(anomaly.severity)}
          </Text>
        </View>
        <View className={styles.infoRow}>
          <Text className={styles.label}>预期值</Text>
          <Text className={`${styles.value} ${styles.success}`}>{anomaly.expectedValue.toFixed(2)} {unit}</Text>
        </View>
        <View className={styles.infoRow}>
          <Text className={styles.label}>实际值</Text>
          <Text className={`${styles.value} ${styles.danger}`}>{anomaly.actualValue.toFixed(2)} {unit}</Text>
        </View>
        <View className={styles.infoRow}>
          <Text className={styles.label}>偏差值</Text>
          <Text className={`${styles.value} ${styles.danger}`}>{anomaly.deviation.toFixed(2)}%</Text>
        </View>
        <View className={styles.infoRow}>
          <Text className={styles.label}>检测时间</Text>
          <Text className={styles.value}>{dayjs(anomaly.date).format('YYYY-MM-DD HH:mm:ss')}</Text>
        </View>
        <View className={styles.infoRow}>
          <Text className={styles.label}>所属航次</Text>
          <Text className={styles.value}>{voyage ? `${voyage.fromPort} → ${voyage.toPort}` : '--'}</Text>
        </View>
      </View>

      {anomaly.isResolved ? (
        <View className={styles.resolutionSection}>
          <View className={styles.sectionTitle}>
            <Text className={styles.icon}>✅</Text>
            <Text>处理结果</Text>
          </View>
          <View className={styles.resolvedInfo}>
            <View className={styles.resolvedHeader}>
              <Text className={styles.resolvedBy}>处理人：{anomaly.resolvedBy}</Text>
              <Text className={styles.resolvedAt}>{dayjs(anomaly.resolvedAt).format('YYYY-MM-DD HH:mm')}</Text>
            </View>
            <Text className={styles.resolutionText}>{anomaly.resolution}</Text>
          </View>
        </View>
      ) : (
        <View className={styles.resolutionSection}>
          <View className={styles.sectionTitle}>
            <Text className={styles.icon}>✏️</Text>
            <Text>处理异常</Text>
          </View>
          <View className={styles.formGroup}>
            <Text className={styles.formLabel}>请填写处理说明（必填）</Text>
            <Textarea
              className={styles.formTextarea}
              placeholder='请说明异常原因和处理措施，如：逆风航行导致油耗增加、油舱正常蒸发等'
              value={resolution}
              onInput={(e) => setResolution(e.detail.value)}
              maxlength={500}
            />
            <Text className={styles.formHint}>已输入 {resolution.length}/500 字</Text>
          </View>
        </View>
      )}

      <View style={{ height: 160 }} />

      {!anomaly.isResolved && (
        <View className={styles.bottomBar}>
          <Button className={styles.btnIgnore} onClick={handleIgnore} disabled={isSubmitting}>
            忽略
          </Button>
          <Button className={styles.btnResolve} onClick={handleResolve} disabled={isSubmitting || !resolution.trim()}>
            {isSubmitting ? '提交中...' : '标记为已处理'}
          </Button>
        </View>
      )}
    </ScrollView>
  )
}

export default AnomalyDetailPage
