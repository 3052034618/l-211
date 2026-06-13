import React, { useState, useCallback, useMemo } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useRouter, useDidShow, usePullDownRefresh } from '@tarojs/taro'
import classnames from 'classnames'
import styles from './index.module.scss'
import { useVoyageStore } from '@/store/useVoyageStore'
import type { Voyage, Tank } from '@/types'
import dayjs from 'dayjs'

const VoyageDetailPage: React.FC = () => {
  const router = useRouter()
  const { getVoyageById, exportDailyReport, exportHandover, syncData, loadData } = useVoyageStore()

  const [voyage, setVoyage] = useState<Voyage | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const voyageId = router.params.id || ''

  useDidShow(() => {
    loadVoyageData()
  })

  usePullDownRefresh(() => {
    handleRefresh()
  })

  const loadVoyageData = async () => {
    await loadData()
    const found = getVoyageById(voyageId)
    if (found) {
      setVoyage(found)
    }
  }

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await syncData()
      await loadVoyageData()
    } catch (error) {
      console.error('[VoyageDetailPage] 刷新失败', error)
      Taro.showToast({ title: '刷新失败', icon: 'none' })
    } finally {
      setIsRefreshing(false)
      Taro.stopPullDownRefresh()
    }
  }, [syncData, loadVoyageData])

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      active: '航行中',
      completed: '已完成',
      draft: '草稿'
    }
    return statusMap[status] || status
  }

  const calculateVoyageDays = () => {
    if (!voyage) return 0
    const start = dayjs(voyage.departureDate)
    const end = voyage.arrivalDate ? dayjs(voyage.arrivalDate) : dayjs()
    return end.diff(start, 'day') + 1
  }

  const getTankProgressStatus = (tank: Tank) => {
    const percentage = (tank.currentLevel / tank.capacity) * 100
    if (percentage <= 20) return 'danger'
    if (percentage <= 40) return 'warning'
    return 'normal'
  }

  const handleRefuelClick = (recordId: string) => {
    Taro.navigateTo({
      url: `/pages/refuel-detail/index?id=${recordId}`
    })
  }

  const handleAnomalyClick = (anomalyId: string) => {
    Taro.navigateTo({
      url: `/pages/anomaly-detail/index?id=${anomalyId}`
    })
  }

  const handleHandoverClick = () => {
    if (voyage?.handoverReport) {
      Taro.navigateTo({
        url: `/pages/handover-preview/index?id=${voyage.id}`
      })
    }
  }

  const handleArchiveClick = () => {
    if (voyageId) {
      Taro.navigateTo({
        url: `/pages/voyage-archive/index?id=${voyageId}`
      })
    }
  }

  const handleExportDaily = async () => {
    if (!voyage) return
    try {
      const latestDate = voyage.dailyConsumptions.length > 0
        ? voyage.dailyConsumptions[voyage.dailyConsumptions.length - 1].date
        : dayjs().format('YYYY-MM-DD')

      const result = await exportDailyReport(voyage.id, latestDate)
      Taro.showToast({
        title: result.success ? '导出成功' : result.message,
        icon: result.success ? 'success' : 'none'
      })
    } catch (error) {
      console.error('[VoyageDetailPage] 导出日报失败', error)
      Taro.showToast({ title: '导出失败', icon: 'none' })
    }
  }

  const handleExportHandover = async () => {
    if (!voyage) return
    try {
      const result = await exportHandover(voyage.id)
      Taro.showToast({
        title: result.success ? '导出成功' : result.message,
        icon: result.success ? 'success' : 'none'
      })
    } catch (error) {
      console.error('[VoyageDetailPage] 导出交接单失败', error)
      Taro.showToast({ title: '导出失败', icon: 'none' })
    }
  }

  const totalRefueled = useMemo(() => {
    if (!voyage) return 0
    return voyage.refuelRecords.reduce((sum, r) => sum + r.quantity, 0)
  }, [voyage])

  const sortedRefuelRecords = useMemo(() => {
    if (!voyage) return []
    return [...voyage.refuelRecords].sort((a, b) =>
      dayjs(b.date).valueOf() - dayjs(a.date).valueOf()
    )
  }, [voyage])

  const sortedAnomalies = useMemo(() => {
    if (!voyage) return []
    return [...voyage.anomalies].sort((a, b) =>
      dayjs(b.date).valueOf() - dayjs(a.date).valueOf()
    )
  }, [voyage])

  const sortedDailyConsumptions = useMemo(() => {
    if (!voyage) return []
    return [...voyage.dailyConsumptions].sort((a, b) =>
      dayjs(b.date).valueOf() - dayjs(a.date).valueOf()
    )
  }, [voyage])

  if (!voyage) {
    return (
      <View className={styles.page}>
        <View className={styles.loadingState}>
          <Text>加载中...</Text>
        </View>
      </View>
    )
  }

  return (
    <ScrollView className={styles.page} scrollY>
      <View className={styles.headerCard}>
        <Text className={styles.vesselName}>{voyage.vesselName}</Text>
        <View className={styles.voyageRoute}>
          <Text>{voyage.fromPort}</Text>
          <Text className={styles.routeArrow}>→</Text>
          <Text>{voyage.toPort}</Text>
        </View>
        <View className={styles.voyageMeta}>
          <View className={styles.metaItem}>
            <Text className={styles.metaLabel}>航行天数</Text>
            <Text className={styles.metaValue}>{calculateVoyageDays()} 天</Text>
          </View>
          <View className={styles.metaItem}>
            <Text className={styles.metaLabel}>船长</Text>
            <Text className={styles.metaValue}>{voyage.captain}</Text>
          </View>
          <View className={styles.metaItem}>
            <Text className={styles.metaLabel}>轮机长</Text>
            <Text className={styles.metaValue}>{voyage.chiefEngineer}</Text>
          </View>
        </View>
        <View className={classnames(styles.statusBadge, styles[voyage.status])}>
          <Text>{getStatusText(voyage.status)}</Text>
        </View>
      </View>

      <View className={styles.sectionCard}>
        <View className={styles.sectionHeader}>
          <View className={styles.sectionTitle}>
            <Text className={styles.icon}>🛢️</Text>
            <Text>油舱记录</Text>
          </View>
          <Text className={styles.viewAll}>
            共 {voyage.tanks.length} 个
          </Text>
        </View>
        {voyage.tanks.length > 0 ? (
          <View className={styles.tankList}>
            {voyage.tanks.map(tank => {
              const percentage = ((tank.currentLevel / tank.capacity) * 100).toFixed(1)
              const status = getTankProgressStatus(tank)
              return (
                <View key={tank.id} className={styles.tankItem}>
                  <View className={styles.tankHeader}>
                    <Text className={styles.tankName}>{tank.name}</Text>
                    <View className={styles.tankFuelType}>
                      <Text>{tank.fuelType}</Text>
                    </View>
                  </View>
                  <View className={styles.tankProgress}>
                    <View
                      className={classnames(styles.progressBar, styles[status])}
                      style={{ width: `${percentage}%` }}
                    />
                  </View>
                  <View className={styles.tankLevelInfo}>
                    <Text>
                      <Text className={styles.levelValue}>{tank.currentLevel.toFixed(2)}</Text>
                      {' / '}
                      {tank.capacity} 吨
                    </Text>
                    <Text>{percentage}%</Text>
                  </View>
                </View>
              )
            })}
          </View>
        ) : (
          <View className={styles.emptyState}>
            <Text className={styles.emptyIcon}>📭</Text>
            <Text className={styles.emptyText}>暂无油舱记录</Text>
          </View>
        )}
      </View>

      <View className={styles.sectionCard}>
        <View className={styles.sectionHeader}>
          <View className={styles.sectionTitle}>
            <Text className={styles.icon}>⛽</Text>
            <Text>加油记录</Text>
          </View>
          <Text className={styles.viewAll}>
            共 {voyage.refuelRecords.length} 条
          </Text>
        </View>
        {sortedRefuelRecords.length > 0 ? (
          <View className={styles.recordList}>
            {sortedRefuelRecords.slice(0, 3).map(record => (
              <View
                key={record.id}
                className={styles.recordItem}
                onClick={() => handleRefuelClick(record.id)}
              >
                <View className={styles.recordInfo}>
                  <Text className={styles.recordTitle}>{record.port}</Text>
                  <Text className={styles.recordDesc}>
                    {dayjs(record.date).format('YYYY-MM-DD')} · {record.tankName} · {record.quantity.toFixed(2)} 吨
                  </Text>
                </View>
                <Text className={styles.recordArrow}>›</Text>
              </View>
            ))}
          </View>
        ) : (
          <View className={styles.emptyState}>
            <Text className={styles.emptyIcon}>📭</Text>
            <Text className={styles.emptyText}>暂无加油记录</Text>
          </View>
        )}
      </View>

      <View className={styles.sectionCard}>
        <View className={styles.sectionHeader}>
          <View className={styles.sectionTitle}>
            <Text className={styles.icon}>⚠️</Text>
            <Text>异常记录</Text>
          </View>
          <Text className={styles.viewAll}>
            共 {voyage.anomalies.length} 条
          </Text>
        </View>
        {sortedAnomalies.length > 0 ? (
          <View className={styles.recordList}>
            {sortedAnomalies.slice(0, 3).map(anomaly => (
              <View
                key={anomaly.id}
                className={classnames(styles.anomalyItem, styles[anomaly.severity])}
                onClick={() => handleAnomalyClick(anomaly.id)}
              >
                <View className={styles.anomalyInfo}>
                  <Text className={styles.anomalyTitle}>{anomaly.description}</Text>
                  <Text className={styles.anomalyDesc}>
                    {dayjs(anomaly.date).format('YYYY-MM-DD')} · 偏差 {anomaly.deviation}%
                  </Text>
                </View>
                <View className={classnames(styles.anomalyStatus, anomaly.isResolved ? styles.resolved : styles.unresolved)}>
                  <Text>{anomaly.isResolved ? '已处理' : '未处理'}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View className={styles.emptyState}>
            <Text className={styles.emptyIcon}>✅</Text>
            <Text className={styles.emptyText}>暂无异常记录</Text>
          </View>
        )}
      </View>

      <View className={styles.sectionCard}>
        <View className={styles.sectionHeader}>
          <View className={styles.sectionTitle}>
            <Text className={styles.icon}>📊</Text>
            <Text>每日油耗</Text>
          </View>
          <Text className={styles.viewAll}>
            共 {voyage.dailyConsumptions.length} 天
          </Text>
        </View>
        {sortedDailyConsumptions.length > 0 ? (
          <View className={styles.dailyList}>
            {sortedDailyConsumptions.slice(0, 5).map(daily => (
              <View key={daily.id} className={styles.dailyItem}>
                <View className={styles.dailyDate}>
                  <Text className={styles.date}>{dayjs(daily.date).format('MM-DD')}</Text>
                  <Text className={styles.weather}>{daily.weather}</Text>
                </View>
                <View className={styles.dailyStats}>
                  <View className={styles.stat}>
                    <Text className={styles.value}>{daily.consumed.toFixed(2)}</Text>
                    <Text className={styles.label}>吨</Text>
                  </View>
                  <View className={styles.stat}>
                    <Text className={styles.value}>{daily.distance.toFixed(1)}</Text>
                    <Text className={styles.label}>海里</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View className={styles.emptyState}>
            <Text className={styles.emptyIcon}>📭</Text>
            <Text className={styles.emptyText}>暂无油耗记录</Text>
          </View>
        )}
      </View>

      <View className={styles.sectionCard}>
        <View className={styles.sectionHeader}>
          <View className={styles.sectionTitle}>
            <Text className={styles.icon}>📋</Text>
            <Text>交接单</Text>
          </View>
        </View>
        {voyage.handoverReport ? (
          <View className={styles.handoverCard} onClick={handleHandoverClick}>
            <View className={styles.handoverHeader}>
              <Text className={styles.handoverTitle}>燃油交接单</Text>
              <View className={styles.handoverStatus}>
                <Text>
                  {voyage.handoverReport.status === 'confirmed' ? '已确认' :
                   voyage.handoverReport.status === 'pending' ? '待确认' : '草稿'}
                </Text>
              </View>
            </View>
            <View className={styles.handoverInfo}>
              <View className={styles.infoItem}>
                <Text className={styles.label}>总耗油量</Text>
                <Text className={styles.value}>{voyage.handoverReport.totalFuelConsumed.toFixed(2)} 吨</Text>
              </View>
              <View className={styles.infoItem}>
                <Text className={styles.label}>总加油量</Text>
                <Text className={styles.value}>{totalRefueled.toFixed(2)} 吨</Text>
              </View>
              <View className={styles.infoItem}>
                <Text className={styles.label}>日均油耗</Text>
                <Text className={styles.value}>{voyage.handoverReport.avgDailyConsumption.toFixed(2)} 吨</Text>
              </View>
            </View>
            <View className={styles.viewDetail}>
              <Text>查看详情 ›</Text>
            </View>
          </View>
        ) : (
          <View className={styles.emptyState}>
            <Text className={styles.emptyIcon}>📄</Text>
            <Text className={styles.emptyText}>暂无交接单</Text>
          </View>
        )}
      </View>

      {/* 航次档案时间线入口 */}
      <View className={styles.sectionCard} onClick={handleArchiveClick}>
        <View className={styles.archiveEntry}>
          <View className={styles.archiveIcon}>
            <Text>📚</Text>
          </View>
          <View className={styles.archiveInfo}>
            <Text className={styles.archiveTitle}>航次档案时间线</Text>
            <Text className={styles.archiveDesc}>查看本次航程所有操作记录时间线</Text>
          </View>
          <Text className={styles.archiveArrow}>›</Text>
        </View>
      </View>

      <View style={{ height: 40 }} />

      <View className={styles.bottomBar}>
        <View className={styles.btnSecondary} onClick={handleExportDaily}>
          <Text>燃油日报</Text>
        </View>
        <View className={styles.btnPrimary} onClick={handleExportHandover}>
          <Text>导出交接单</Text>
        </View>
      </View>
    </ScrollView>
  )
}

export default VoyageDetailPage
