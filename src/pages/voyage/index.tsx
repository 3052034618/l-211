import React, { useState, useCallback } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import classnames from 'classnames'
import styles from './index.module.scss'
import { useVoyageStore } from '@/store/useVoyageStore'
import StatCard from '@/components/StatCard'
import AnomalyBadge from '@/components/AnomalyBadge'
import { mockUser, mockManagerUser } from '@/data/mockData'
import { formatFuelAmount } from '@/utils/fuelCalculator'
import dayjs from 'dayjs'
import type { User } from '@/types'

const VoyagePage: React.FC = () => {
  const {
    currentVoyage,
    voyageList,
    isOffline,
    user,
    offlineQueue,
    setUser,
    loadData,
    syncData
  } = useVoyageStore()

  const [, setIsRefreshing] = useState(false)

  useDidShow(() => {
    initData()
  })

  usePullDownRefresh(() => {
    handleRefresh()
  })

  const initData = async () => {
    await loadData()
    
    if (!useVoyageStore.getState().user) {
      setUser(mockUser)
    }
  }

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await syncData()
      await initData()
    } catch (error) {
      console.error('[VoyagePage] 刷新失败', error)
    } finally {
      setIsRefreshing(false)
      Taro.stopPullDownRefresh()
    }
  }, [syncData, initData])

  const calculateVoyageDays = () => {
    if (!currentVoyage) return 0
    const start = dayjs(currentVoyage.departureDate)
    const end = currentVoyage.arrivalDate ? dayjs(currentVoyage.arrivalDate) : dayjs()
    return end.diff(start, 'day') + 1
  }

  const unresolvedAnomalies = currentVoyage?.anomalies.filter(a => !a.isResolved) || []
  const completedVoyages = voyageList.filter(v => v.status === 'completed').slice(0, 3)

  const quickActions = [
    { key: 'create', label: '创建航次', icon: '➕', color: 'create' },
    { key: 'tank', label: '录入油舱', icon: '🛢️', color: 'tank' },
    { key: 'refuel', label: '登记加油', icon: '⛽', color: 'refuel' },
    { key: 'engine', label: '记录主机', icon: '⚙️', color: 'engine' },
    { key: 'handover', label: '生成交接', icon: '📋', color: 'handover' },
    { key: 'fleet', label: '船队管理', icon: '🚢', color: 'fleet' }
  ]

  const handleActionClick = (key: string) => {
    if (key === 'fleet') {
      handleFleetManage()
      return
    }
    const routes: Record<string, string> = {
      create: '/pages/create-voyage/index',
      tank: '/pages/tank/index',
      refuel: '/pages/refuel/index',
      engine: '/pages/analysis/index',
      handover: '/pages/handover/index'
    }
    if (routes[key]) {
      Taro.switchTab({ url: routes[key] }).catch(() => {
        Taro.navigateTo({ url: routes[key] })
      })
    }
  }

  const handleAnomalyClick = (anomalyId: string) => {
    Taro.navigateTo({
      url: `/pages/anomaly-detail/index?id=${anomalyId}`
    })
  }

  const handleHistoryClick = (voyageId: string) => {
    Taro.navigateTo({
      url: `/pages/voyage-detail/index?id=${voyageId}`
    })
  }

  const handleRoleSwitch = () => {
    const items = [
      { text: '船员视角', value: 'crew' },
      { text: '管理人员视角', value: 'manager' }
    ]
    
    Taro.showActionSheet({
      itemList: items.map(i => i.text),
      success: (res) => {
        const selected = items[res.tapIndex]
        if (selected.value === 'manager') {
          setUser(mockManagerUser as User)
          Taro.navigateTo({ url: '/pages/fleet/index' })
        } else {
          setUser(mockUser)
        }
      }
    })
  }

  const handleFleetManage = () => {
    if (user?.role === 'manager') {
      Taro.navigateTo({ url: '/pages/fleet/index' })
    } else {
      Taro.showModal({
        title: '切换身份',
        content: '船队管理需要管理人员身份，是否切换？',
        success: (res) => {
          if (res.confirm) {
            setUser(mockManagerUser as User)
            Taro.navigateTo({ url: '/pages/fleet/index' })
          }
        }
      })
    }
  }

  const handleSyncOffline = async () => {
    Taro.navigateTo({ url: '/pages/offline-queue/index' })
  }

  return (
    <ScrollView className={styles.page} scrollY>
      {/* 顶部航次概览 */}
      <View className={styles.headerSection}>
        <View className={styles.topBar}>
          <View className={styles.userInfo} onClick={handleRoleSwitch}>
            <View className={styles.avatar}>
              <Text>{user?.role === 'manager' ? '👔' : '👨‍✈️'}</Text>
            </View>
            <View className={styles.userDetail}>
              <Text className={styles.userName}>{user?.name || '未登录'}</Text>
              <Text className={styles.userRole}>{user?.role === 'manager' ? '管理人员' : '船员'}</Text>
            </View>
            <Text className={styles.switchIcon}>⇄</Text>
          </View>
          <View className={styles.syncStatus}>
            <View className={classnames(styles.syncIndicator, isOffline && styles.offline)} />
            <Text className={styles.syncText}>
              {isOffline ? '离线模式' : '已同步'}
            </Text>
          </View>
        </View>

        {offlineQueue.length > 0 && (
          <View className={styles.offlineBanner} onClick={handleSyncOffline}>
            <Text className={styles.offlineIcon}>📡</Text>
            <Text className={styles.offlineText}>
              {offlineQueue.length}条数据待同步，点击立即上传
            </Text>
            <Text className={styles.offlineArrow}>›</Text>
          </View>
        )}

        {currentVoyage && (
          <View className={styles.voyageOverview}>
            <Text className={styles.vesselName}>{currentVoyage.vesselName}</Text>
            <View className={styles.voyageRoute}>
              <Text>{currentVoyage.fromPort}</Text>
              <Text className={styles.routeArrow}>→</Text>
              <Text>{currentVoyage.toPort}</Text>
            </View>
            <View className={styles.voyageInfo}>
              <View className={styles.voyageDays}>
                <Text className={styles.daysNumber}>{calculateVoyageDays()}</Text>
                <Text className={styles.daysLabel}>天</Text>
              </View>
              <Text className={styles.voyageStatus}>
                {currentVoyage.status === 'active' ? '航行中' : 
                 currentVoyage.status === 'completed' ? '已完成' : '草稿'}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* 数据统计 */}
      <View className={styles.statsSection}>
        <View className={styles.statsGrid}>
          <StatCard
            title='总存油量'
            value={currentVoyage ? formatFuelAmount(currentVoyage.currentFuelLevel) : '0'}
            unit='吨'
            icon='🛢️'
            color='#1E88E5'
            trend='down'
            trendValue={2.3}
          />
          <StatCard
            title='已耗油量'
            value={currentVoyage ? formatFuelAmount(currentVoyage.totalFuelConsumed || 0) : '0'}
            unit='吨'
            icon='📊'
            color='#FF9800'
            trend='stable'
            trendValue={0.5}
          />
          <StatCard
            title='日均油耗'
            value={currentVoyage?.avgDailyConsumption || '0'}
            unit='吨/天'
            icon='📈'
            color='#26A69A'
          />
          <StatCard
            title='航行距离'
            value={currentVoyage?.totalDistance || '0'}
            unit='海里'
            icon='🌊'
            color='#9C27B0'
          />
        </View>
      </View>

      {/* 快速操作 */}
      <View className={styles.quickActions}>
        <Text className={styles.sectionTitle}>快速操作</Text>
        <ScrollView className={styles.actionsScroll} scrollX enableFlex>
          {quickActions.map(action => (
            <View
              key={action.key}
              className={styles.actionItem}
              onClick={() => handleActionClick(action.key)}
            >
              <View className={classnames(styles.actionIcon, styles[action.color])}>
                <Text>{action.icon}</Text>
              </View>
              <Text className={styles.actionLabel}>{action.label}</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* 异常预警 */}
      {unresolvedAnomalies.length > 0 && (
        <View className={styles.anomalySection}>
          <Text className={styles.sectionTitle}>异常预警 ({unresolvedAnomalies.length})</Text>
          {unresolvedAnomalies.map(anomaly => (
            <View
              key={anomaly.id}
              className={classnames(styles.anomalyCard, styles[anomaly.severity])}
              onClick={() => handleAnomalyClick(anomaly.id)}
            >
              <View className={styles.anomalyContent}>
                <View className={styles.anomalyTitle}>
                  <Text className={styles.anomalyType}>{anomaly.description}</Text>
                  <AnomalyBadge severity={anomaly.severity} />
                </View>
                <Text className={styles.anomalyDesc}>
                  期望值 {anomaly.expectedValue}，实际值 {anomaly.actualValue}，偏差 {anomaly.deviation}%
                </Text>
              </View>
              <Text className={styles.anomalyDate}>{anomaly.date}</Text>
            </View>
          ))}
        </View>
      )}

      {/* 历史航次 */}
      <View className={styles.historySection}>
        <Text className={styles.sectionTitle}>历史航次</Text>
        {completedVoyages.length > 0 ? (
          completedVoyages.map(voyage => (
            <View
              key={voyage.id}
              className={styles.historyItem}
              onClick={() => handleHistoryClick(voyage.id)}
            >
              <View className={styles.historyHeader}>
                <Text className={styles.historyVessel}>{voyage.vesselName}</Text>
                <Text className={styles.historyStatus}>已完成</Text>
              </View>
              <Text className={styles.historyRoute}>
                {voyage.fromPort} → {voyage.toPort}
              </Text>
              <View className={styles.historyStats}>
                <Text>{dayjs(voyage.departureDate).format('YYYY-MM-DD')}</Text>
                <Text>耗油 {formatFuelAmount(voyage.totalFuelConsumed || 0)} 吨</Text>
                <Text>{voyage.totalDistance} 海里</Text>
              </View>
            </View>
          ))
        ) : (
          <View className={styles.emptyState}>
            <Text className={styles.emptyIcon}>📭</Text>
            <Text>暂无历史航次</Text>
          </View>
        )}
      </View>
    </ScrollView>
  )
}

export default VoyagePage
