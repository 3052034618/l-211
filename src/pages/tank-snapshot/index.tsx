import React, { useState, useCallback, useMemo } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useRouter, useDidShow, usePullDownRefresh } from '@tarojs/taro'
import classnames from 'classnames'
import styles from './index.module.scss'
import { useVoyageStore } from '@/store/useVoyageStore'
import type { Voyage, Tank } from '@/types'
import dayjs from 'dayjs'

const TankSnapshotPage: React.FC = () => {
  const router = useRouter()
  const { getVoyageById, syncData, loadData } = useVoyageStore()

  const [voyage, setVoyage] = useState<Voyage | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [, setIsRefreshing] = useState(false)

  const voyageId = router.params.voyageId || router.params.id || ''

  useDidShow(() => {
    loadVoyageData()
  })

  usePullDownRefresh(() => {
    handleRefresh()
  })

  const loadVoyageData = async () => {
    setIsLoading(true)
    try {
      await loadData()
      const found = getVoyageById(voyageId)
      if (found) {
        setVoyage(found)
      } else {
        setVoyage(null)
      }
    } catch (error) {
      console.error('[TankSnapshotPage] 加载航次数据失败', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await syncData()
      await loadVoyageData()
    } catch (error) {
      console.error('[TankSnapshotPage] 刷新失败', error)
      Taro.showToast({ title: '刷新失败', icon: 'none' })
    } finally {
      setIsRefreshing(false)
      Taro.stopPullDownRefresh()
    }
  }, [syncData])

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      active: '航行中',
      completed: '已完成',
      draft: '草稿'
    }
    return statusMap[status] || status
  }

  const getTankLevelStatus = (percentage: number): 'high' | 'medium' | 'low' => {
    if (percentage > 60) return 'high'
    if (percentage >= 30) return 'medium'
    return 'low'
  }

  const getOverallProgressStatus = (percentage: number): 'high' | 'medium' | 'low' => {
    if (percentage > 60) return 'high'
    if (percentage >= 30) return 'medium'
    return 'low'
  }

  const getProgressColor = (status: 'high' | 'medium' | 'low') => {
    const colorMap = {
      high: '#4CAF50',
      medium: '#FF9800',
      low: '#F44336'
    }
    return colorMap[status]
  }

  const tanks = useMemo(() => voyage?.tanks || [], [voyage])

  const totalCapacity = useMemo(() =>
    tanks.reduce((sum, t) => sum + (t.capacity || 0), 0),
    [tanks]
  )

  const totalCurrent = useMemo(() =>
    tanks.reduce((sum, t) => sum + (t.currentLevel || 0), 0),
    [tanks]
  )

  const totalPercentage = useMemo(() =>
    totalCapacity > 0 ? (totalCurrent / totalCapacity) * 100 : 0,
    [totalCapacity, totalCurrent]
  )

  const overallStatus = getOverallProgressStatus(totalPercentage)

  if (isLoading) {
    return (
      <View className={styles.page}>
        <View className={styles.loadingState}>
          <Text>加载中...</Text>
        </View>
      </View>
    )
  }

  if (!voyage) {
    return (
      <View className={styles.page}>
        <View className={styles.emptyState}>
          <Text className={styles.emptyIcon}>🚢</Text>
          <Text className={styles.emptyTitle}>航次不存在</Text>
          <Text className={styles.emptyDesc}>无法找到该航次的记录</Text>
        </View>
      </View>
    )
  }

  if (tanks.length === 0) {
    return (
      <ScrollView className={styles.page} scrollY>
        <View className={styles.voyageHeader}>
          <View className={styles.voyageRoute}>
            <Text>{voyage.fromPort}</Text>
            <Text className={styles.routeArrow}>→</Text>
            <Text>{voyage.toPort}</Text>
          </View>
          <Text className={styles.vesselName}>{voyage.vesselName}</Text>
          <View className={classnames(styles.statusBadge, styles[voyage.status])}>
            <Text>{getStatusText(voyage.status)}</Text>
          </View>
        </View>

        <View className={styles.emptyState}>
          <Text className={styles.emptyIcon}>🛢️</Text>
          <Text className={styles.emptyTitle}>该航次暂无油舱配置</Text>
          <Text className={styles.emptyDesc}>请先在航次中配置油舱信息</Text>
        </View>
      </ScrollView>
    )
  }

  return (
    <ScrollView className={styles.page} scrollY>
      <View className={styles.voyageHeader}>
        <View className={styles.voyageRoute}>
          <Text>{voyage.fromPort}</Text>
          <Text className={styles.routeArrow}>→</Text>
          <Text>{voyage.toPort}</Text>
        </View>
        <Text className={styles.vesselName}>{voyage.vesselName}</Text>
        <View className={classnames(styles.statusBadge, styles[voyage.status])}>
          <Text>{getStatusText(voyage.status)}</Text>
        </View>
      </View>

      <View className={styles.summarySection}>
        <Text className={styles.summaryTitle}>油舱统计概览</Text>
        <View className={styles.summaryStats}>
          <View className={styles.summaryItem}>
            <Text className={styles.summaryValue}>{totalCapacity.toFixed(2)}</Text>
            <Text className={styles.summaryLabel}>总容量(吨)</Text>
          </View>
          <View className={styles.summaryDivider} />
          <View className={styles.summaryItem}>
            <Text className={styles.summaryValue}>{totalCurrent.toFixed(2)}</Text>
            <Text className={styles.summaryLabel}>当前存量(吨)</Text>
          </View>
          <View className={styles.summaryDivider} />
          <View className={styles.summaryItem}>
            <Text className={styles.summaryValue}>{tanks.length}</Text>
            <Text className={styles.summaryLabel}>油舱数</Text>
          </View>
        </View>
        <View className={styles.progressSection}>
          <View className={styles.progressLabel}>
            <Text className={styles.label}>存量占比</Text>
            <Text className={styles.value}>{totalPercentage.toFixed(1)}%</Text>
          </View>
          <View className={styles.progressBar}>
            <View
              className={classnames(styles.progressFill, styles[overallStatus])}
              style={{
                width: `${Math.min(totalPercentage, 100)}%`,
                background: getProgressColor(overallStatus)
              }}
            />
          </View>
        </View>
      </View>

      <View className={styles.tanksSection}>
        <View className={styles.sectionHeader}>
          <Text className={styles.sectionTitle}>油舱列表</Text>
          <Text className={styles.tankCount}>共 {tanks.length} 个</Text>
        </View>
        <View className={styles.tankList}>
          {tanks.map((tank: Tank) => {
            const percentage = tank.capacity > 0
              ? (tank.currentLevel / tank.capacity) * 100
              : 0
            const status = getTankLevelStatus(percentage)
            return (
              <View key={tank.id} className={styles.tankCard}>
                <View className={styles.tankHeader}>
                  <Text className={styles.tankName}>{tank.name}</Text>
                  <View className={styles.fuelTypeBadge}>
                    <Text>{tank.fuelType}</Text>
                  </View>
                </View>
                <View className={styles.tankProgress}>
                  <View
                    className={classnames(styles.progressFill, styles[status])}
                    style={{
                      width: `${Math.min(percentage, 100)}%`,
                      background: getProgressColor(status)
                    }}
                  />
                </View>
                <View className={styles.tankFooter}>
                  <Text className={styles.tankLevel}>
                    <Text className={styles.levelValue}>{tank.currentLevel.toFixed(2)}</Text>
                    {' / '}{tank.capacity} 吨
                  </Text>
                  <Text className={classnames(styles.levelPercentage, styles[status])}>
                    {percentage.toFixed(1)}%
                  </Text>
                </View>
                {tank.lastUpdate && (
                  <Text className={styles.lastUpdate}>
                    最后更新：{dayjs(tank.lastUpdate).format('YYYY-MM-DD HH:mm:ss')}
                  </Text>
                )}
              </View>
            )
          })}
        </View>
      </View>
    </ScrollView>
  )
}

export default TankSnapshotPage
