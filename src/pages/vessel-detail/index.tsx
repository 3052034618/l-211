import React, { useState, useCallback, useMemo } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh, useRouter } from '@tarojs/taro'
import classnames from 'classnames'
import styles from './index.module.scss'
import { useVoyageStore } from '@/store/useVoyageStore'
import { formatFuelAmount } from '@/utils/fuelCalculator'
import dayjs from 'dayjs'
import type { Voyage, Tank, AnomalyRecord, RefuelRecord } from '@/types'

type VoyageTabType = 'all' | 'active' | 'completed'

const VesselDetailPage: React.FC = () => {
  const router = useRouter()
  const vesselId = router.params.id || ''
  const vesselName = router.params.name || ''

  const {
    vessels,
    voyageList,
    user,
    isLoading,
    isOffline,
    loadFleetData,
    getVesselById,
    getVesselVoyages,
    syncOfflineData
  } = useVoyageStore()

  const [activeTab, setActiveTab] = useState<VoyageTabType>('all')
  const [, setIsRefreshing] = useState(false)

  useDidShow(() => {
    initData()
  })

  usePullDownRefresh(() => {
    handleRefresh()
  })

  const initData = async () => {
    await loadFleetData()
  }

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      if (isOffline) {
        await syncOfflineData()
      }
      await loadFleetData()
    } catch (error) {
      console.error('[VesselDetailPage] 刷新失败', error)
    } finally {
      setIsRefreshing(false)
      Taro.stopPullDownRefresh()
    }
  }, [loadFleetData, isOffline, syncOfflineData])

  const vessel = useMemo(() => {
    return getVesselById(vesselId) || vessels.find(v => v.name === vesselName)
  }, [vesselId, vesselName, vessels, getVesselById])

  const vesselVoyages = useMemo(() => {
    return getVesselVoyages(vessel?.name || vesselName || '')
  }, [vessel, vesselName, getVesselVoyages])

  const filteredVoyages = useMemo(() => {
    switch (activeTab) {
      case 'active':
        return vesselVoyages.filter(v => v.status === 'active')
      case 'completed':
        return vesselVoyages.filter(v => v.status === 'completed')
      default:
        return vesselVoyages
    }
  }, [vesselVoyages, activeTab])

  const activeVoyage = useMemo(() => {
    return vesselVoyages.find(v => v.status === 'active')
  }, [vesselVoyages])

  const tanks: Tank[] = useMemo(() => {
    return activeVoyage?.tanks || []
  }, [activeVoyage])

  const allAnomalies: AnomalyRecord[] = useMemo(() => {
    return vesselVoyages.flatMap(v => v.anomalies)
      .sort((a, b) => dayjs(b.date).valueOf() - dayjs(a.date).valueOf())
  }, [vesselVoyages])

  const unresolvedAnomalies = useMemo(() => {
    return allAnomalies.filter(a => !a.isResolved)
  }, [allAnomalies])

  const portRefuelSummary = useMemo(() => {
    const portMap = new Map<string, { quantity: number; amount: number; count: number }>()
    
    vesselVoyages.forEach(voyage => {
      voyage.refuelRecords.forEach(record => {
        const existing = portMap.get(record.port) || { quantity: 0, amount: 0, count: 0 }
        existing.quantity += record.quantity
        existing.amount += record.totalAmount
        existing.count += 1
        portMap.set(record.port, existing)
      })
    })

    return Array.from(portMap.entries()).map(([port, stats]) => ({
      port,
      ...stats
    })).sort((a, b) => b.quantity - a.quantity)
  }, [vesselVoyages])

  const getVesselIcon = (type: string) => {
    const icons: Record<string, string> = {
      '散货船': '🚢',
      '集装箱船': '📦',
      '油轮': '🛢️',
      '化学品船': '⚗️',
      '液化气船': '💨',
      '客轮': '🛳️',
      '滚装船': '🚗'
    }
    return icons[type] || '🚢'
  }

  const getTankProgressClass = (currentLevel: number, capacity: number) => {
    const percentage = (currentLevel / capacity) * 100
    if (percentage < 30) return 'danger'
    if (percentage < 50) return 'warning'
    return ''
  }

  const getVoyageStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      'active': '进行中',
      'completed': '已完成',
      'draft': '草稿'
    }
    return statusMap[status] || status
  }

  const getAnomalyIcon = (type: string) => {
    const icons: Record<string, string> = {
      'consumption': '📊',
      'tank_level': '🛢️',
      'engine': '⚙️'
    }
    return icons[type] || '⚠️'
  }

  const handleVoyageClick = (voyageId: string) => {
    Taro.navigateTo({
      url: `/pages/voyage-detail/index?id=${voyageId}`
    })
  }

  const handleTabChange = (tab: VoyageTabType) => {
    setActiveTab(tab)
  }

  const handleAnomalyClick = (anomalyId: string) => {
    Taro.navigateTo({
      url: `/pages/anomaly-detail/index?id=${anomalyId}`
    })
  }

  const handleTrackingClick = () => {
    if (vesselId || vessel?.id) {
      Taro.navigateTo({
        url: `/pages/vessel-tracking/index?vesselId=${vesselId || vessel?.id}&vesselName=${vesselName || vessel?.name}`
      })
    }
  }

  const totalFuel = tanks.reduce((sum, t) => sum + t.currentLevel, 0)
  const totalCapacity = tanks.reduce((sum, t) => sum + t.capacity, 0)

  if (!vessel && !isLoading) {
    return (
      <View className={styles.page}>
        <View className={styles.emptyState}>
          <Text className={styles.emptyIcon}>🚢</Text>
          <Text className={styles.emptyText}>未找到船舶信息</Text>
        </View>
      </View>
    )
  }

  return (
    <ScrollView className={styles.page} scrollY>
      <View className={styles.vesselHeader}>
        <View className={styles.vesselInfo}>
          <View className={styles.vesselIcon}>
            <Text>{getVesselIcon(vessel?.type || '散货船')}</Text>
          </View>
          <View className={styles.vesselDetails}>
            <Text className={styles.vesselName}>{vessel?.name || vesselName}</Text>
            <Text className={styles.vesselType}>{vessel?.type || '散货船'}</Text>
            <View className={styles.vesselStatus}>
              {vessel?.activeVoyageId ? '航行中' : '待命'}
            </View>
          </View>
        </View>

        <View className={styles.quickStats}>
          <View className={styles.quickStat}>
            <Text className={styles.quickStatValue}>
              {formatFuelAmount(vessel?.currentFuelLevel || 0)}
            </Text>
            <Text className={styles.quickStatLabel}>存油量(吨)</Text>
          </View>
          <View className={styles.quickStat}>
            <Text className={styles.quickStatValue}>
              {vessel?.unresolvedAnomalyCount || 0}
            </Text>
            <Text className={styles.quickStatLabel}>异常数</Text>
          </View>
          <View className={styles.quickStat}>
            <Text className={styles.quickStatValue}>
              {vesselVoyages.length}
            </Text>
            <Text className={styles.quickStatLabel}>航次数</Text>
          </View>
        </View>
      </View>

      <View className={styles.section}>
        <View className={styles.sectionHeader}>
          <Text className={styles.sectionTitle}>油舱存量</Text>
          <Text className={styles.sectionAction}>
            {formatFuelAmount(totalFuel)} / {totalCapacity} 吨
          </Text>
        </View>
        <View className={styles.tankList}>
          {tanks.length > 0 ? (
            tanks.map(tank => (
              <View key={tank.id} className={styles.tankItem}>
                <View className={styles.tankInfo}>
                  <Text className={styles.tankName}>{tank.name}</Text>
                  <View className={styles.tankProgress}>
                    <View
                      className={classnames(
                        styles.tankProgressBar,
                        getTankProgressClass(tank.currentLevel, tank.capacity)
                      )}
                      style={{ width: `${(tank.currentLevel / tank.capacity) * 100}%` }}
                    />
                  </View>
                </View>
                <View className={styles.tankLevel}>
                  <Text className={styles.tankLevelValue}>
                    {formatFuelAmount(tank.currentLevel)}
                  </Text>
                  <Text className={styles.tankLevelLabel}>
                    {tank.fuelType} · {tank.capacity}吨
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <View className={styles.emptyState}>
              <Text className={styles.emptyIcon}>🛢️</Text>
              <Text className={styles.emptyText}>暂无油舱数据</Text>
            </View>
          )}
        </View>
      </View>

      <View className={styles.section}>
        <View className={styles.voyageTab}>
          <View
            className={classnames(styles.tabItem, activeTab === 'all' && styles.active)}
            onClick={() => handleTabChange('all')}
          >
            <Text>全部 ({vesselVoyages.length})</Text>
          </View>
          <View
            className={classnames(styles.tabItem, activeTab === 'active' && styles.active)}
            onClick={() => handleTabChange('active')}
          >
            <Text>进行中 ({vesselVoyages.filter(v => v.status === 'active').length})</Text>
          </View>
          <View
            className={classnames(styles.tabItem, activeTab === 'completed' && styles.active)}
            onClick={() => handleTabChange('completed')}
          >
            <Text>已完成 ({vesselVoyages.filter(v => v.status === 'completed').length})</Text>
          </View>
        </View>
        <ScrollView className={styles.voyageList} scrollY>
          {filteredVoyages.length > 0 ? (
            filteredVoyages.map(voyage => (
              <View
                key={voyage.id}
                className={styles.voyageItem}
                onClick={() => handleVoyageClick(voyage.id)}
              >
                <View className={styles.voyageRoute}>
                  <Text className={styles.voyagePorts}>
                    {voyage.fromPort} → {voyage.toPort}
                  </Text>
                  <Text className={styles.voyageDate}>
                    {dayjs(voyage.departureDate).format('YYYY-MM-DD')}
                    {voyage.arrivalDate && ` 至 ${dayjs(voyage.arrivalDate).format('YYYY-MM-DD')}`}
                  </Text>
                </View>
                <View className={styles.voyageMeta}>
                  <View className={classnames(styles.voyageStatus, styles[voyage.status])}>
                    {getVoyageStatusText(voyage.status)}
                  </View>
                  <Text className={styles.voyageFuel}>
                    耗油 {formatFuelAmount(voyage.totalFuelConsumed || 0)} 吨
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <View className={styles.emptyState}>
              <Text className={styles.emptyIcon}>📋</Text>
              <Text className={styles.emptyText}>暂无航次记录</Text>
            </View>
          )}
        </ScrollView>
      </View>

      <View className={styles.section}>
        <View className={styles.sectionHeader}>
          <Text className={styles.sectionTitle}>异常记录</Text>
          <Text className={styles.sectionAction}>
            共 {allAnomalies.length} 条
          </Text>
        </View>
        <View className={styles.anomalySummary}>
          <View className={styles.anomalyStats}>
            <View className={styles.anomalyStat}>
              <Text className={classnames(styles.anomalyStatValue, styles.danger)}>
                {allAnomalies.filter(a => a.severity === 'high').length}
              </Text>
              <Text className={styles.anomalyStatLabel}>高危</Text>
            </View>
            <View className={styles.anomalyStat}>
              <Text className={classnames(styles.anomalyStatValue, styles.warning)}>
                {allAnomalies.filter(a => a.severity === 'medium').length}
              </Text>
              <Text className={styles.anomalyStatLabel}>中危</Text>
            </View>
            <View className={styles.anomalyStat}>
              <Text className={styles.anomalyStatValue}>
                {allAnomalies.filter(a => a.severity === 'low').length}
              </Text>
              <Text className={styles.anomalyStatLabel}>低危</Text>
            </View>
          </View>
          <View className={styles.anomalyList}>
            {unresolvedAnomalies.length > 0 ? (
              unresolvedAnomalies.slice(0, 3).map(anomaly => (
                <View
                  key={anomaly.id}
                  className={classnames(styles.anomalyItem, styles[anomaly.severity])}
                  onClick={() => handleAnomalyClick(anomaly.id)}
                >
                  <Text className={styles.anomalyIcon}>
                    {getAnomalyIcon(anomaly.type)}
                  </Text>
                  <View className={styles.anomalyContent}>
                    <Text className={styles.anomalyDesc}>{anomaly.description}</Text>
                    <Text className={styles.anomalyDate}>
                      {anomaly.date} · 偏差 {anomaly.deviation}%
                    </Text>
                  </View>
                  <View className={classnames(styles.anomalyStatus, styles.pending)}>
                    待处理
                  </View>
                </View>
              ))
            ) : (
              <View className={styles.emptyState}>
                <Text className={styles.emptyIcon}>✅</Text>
                <Text className={styles.emptyText}>暂无待处理异常</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <View className={styles.section}>
        <View className={styles.sectionHeader}>
          <Text className={styles.sectionTitle}>港口加油汇总</Text>
          <Text className={styles.sectionAction}>
            {portRefuelSummary.length} 个港口
          </Text>
        </View>
        <View className={styles.portSummary}>
          {portRefuelSummary.length > 0 ? (
            portRefuelSummary.map(item => (
              <View key={item.port} className={styles.portItem}>
                <Text className={styles.portName}>{item.port}</Text>
                <View className={styles.portStats}>
                  <Text className={styles.portQuantity}>
                    {formatFuelAmount(item.quantity)} 吨
                  </Text>
                  <Text className={styles.portAmount}>
                    ¥{item.amount.toLocaleString()} · {item.count}次
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <View className={styles.emptyState}>
              <Text className={styles.emptyIcon}>⛽</Text>
              <Text className={styles.emptyText}>暂无加油记录</Text>
            </View>
          )}
        </View>
      </View>

      {user?.role === 'manager' && (
        <View className={styles.section} onClick={handleTrackingClick}>
          <View className={styles.sectionHeader}>
            <Text className={styles.sectionTitle}>同步追踪</Text>
            <Text className={styles.sectionAction}>
              查看详情 ›
            </Text>
          </View>
          <View style={{ padding: '20rpx 28rpx', flexDirection: 'row', alignItems: 'center', gap: '16rpx' }}>
            <Text style={{ fontSize: '36rpx' }}>📡</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: '28rpx', color: '#263238', marginBottom: '6rpx' }}>同步记录明细</Text>
              <Text style={{ fontSize: '24rpx', color: '#78909C' }}>查看每次同步的记录数、状态和失败详情</Text>
            </View>
          </View>
        </View>
      )}

      <View className={styles.syncInfo}>
        <View className={classnames(styles.syncIndicator, isOffline && styles.offline)} />
        <Text>
          {isOffline 
            ? '离线模式' 
            : vessel?.lastSyncedAt 
              ? `最后同步 ${dayjs(vessel.lastSyncedAt).format('YYYY-MM-DD HH:mm')}`
              : '暂无同步数据'
          }
        </Text>
      </View>
    </ScrollView>
  )
}

export default VesselDetailPage
