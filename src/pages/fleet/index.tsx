import React, { useState, useCallback } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import classnames from 'classnames'
import styles from './index.module.scss'
import { useVoyageStore } from '@/store/useVoyageStore'
import { mockManagerUser, mockUser } from '@/data/mockData'
import { formatFuelAmount } from '@/utils/fuelCalculator'
import dayjs from 'dayjs'
import type { Vessel } from '@/types'

const FleetPage: React.FC = () => {
  const {
    user,
    vessels,
    fleetSummary,
    isLoading,
    isOffline,
    offlineQueue,
    setUser,
    loadFleetData,
    syncOfflineData
  } = useVoyageStore()

  const [, setIsRefreshing] = useState(false)

  useDidShow(() => {
    initData()
  })

  usePullDownRefresh(() => {
    handleRefresh()
  })

  const initData = async () => {
    if (!user || user.role !== 'manager') {
      setUser(mockManagerUser)
    }
    await loadFleetData()
  }

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      if (isOffline && offlineQueue.length > 0) {
        await syncOfflineData()
      }
      await loadFleetData()
    } catch (error) {
      console.error('[FleetPage] 刷新失败', error)
    } finally {
      setIsRefreshing(false)
      Taro.stopPullDownRefresh()
    }
  }, [loadFleetData, isOffline, offlineQueue.length, syncOfflineData])

  const handleSwitchRole = () => {
    if (user?.role === 'manager') {
      setUser(mockUser)
      Taro.switchTab({ url: '/pages/voyage/index' })
    } else {
      setUser(mockManagerUser)
    }
  }

  const handleVesselClick = (vessel: Vessel) => {
    Taro.navigateTo({
      url: `/pages/vessel-detail/index?id=${vessel.id}&name=${vessel.name}`
    })
  }

  const handleSyncOffline = () => {
    syncOfflineData()
    Taro.showToast({
      title: '正在同步离线数据...',
      icon: 'loading',
      duration: 2000
    })
  }

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

  return (
    <ScrollView className={styles.page} scrollY>
      {/* 离线提示 */}
      {isOffline && offlineQueue.length > 0 && (
        <View className={styles.offlineBanner}>
          <Text className={styles.offlineIcon}>📡</Text>
          <Text className={styles.offlineText}>
            当前离线，有 {offlineQueue.length} 条数据待同步
          </Text>
          <Text className={styles.offlineAction} onClick={handleSyncOffline}>
            立即同步
          </Text>
        </View>
      )}

      {/* 头部用户信息 */}
      <View className={styles.headerSection}>
        <View className={styles.userInfo}>
          <View className={styles.userLeft}>
            <View className={styles.userAvatar}>
              <Text>👤</Text>
            </View>
            <View className={styles.userDetails}>
              <Text className={styles.userName}>{user?.name || '管理员'}</Text>
              <Text className={styles.userRole}>
                {user?.role === 'manager' ? '船队管理' : user?.role === 'captain' ? '船长' : '轮机员'}
              </Text>
            </View>
          </View>
          <Text className={styles.roleSwitch} onClick={handleSwitchRole}>
            切换身份
          </Text>
        </View>

        <Text className={styles.overviewTitle}>船队概览</Text>
        <View className={styles.statsGrid}>
          <View className={styles.statItem}>
            <View className={styles.statValue}>
              {fleetSummary?.totalVessels || 0}
              <Text className={styles.statUnit}>艘</Text>
            </View>
            <View className={styles.statLabel}>在营船舶</View>
          </View>
          <View className={styles.statItem}>
            <View className={styles.statValue}>
              {fleetSummary?.activeVoyages || 0}
              <Text className={styles.statUnit}>个</Text>
            </View>
            <View className={styles.statLabel}>执行中航次</View>
          </View>
          <View className={styles.statItem}>
            <View className={styles.statValue}>
              {fleetSummary ? formatFuelAmount(fleetSummary.totalFuelLevel) : '0'}
              <Text className={styles.statUnit}>吨</Text>
            </View>
            <View className={styles.statLabel}>总存油量</View>
          </View>
          <View className={styles.statItem}>
            <View className={styles.statValue}>
              {fleetSummary?.unresolvedAnomalies || 0}
              <Text className={styles.statUnit}>条</Text>
            </View>
            <View className={styles.statLabel}>待处理异常</View>
          </View>
        </View>
      </View>

      {/* 船舶列表 */}
      <View className={styles.sectionHeader}>
        <Text className={styles.sectionTitle}>船舶列表</Text>
        <Text className={styles.sectionAction}>共 {vessels.length} 艘</Text>
      </View>

      <View className={styles.vesselList}>
        {vessels.length > 0 ? (
          vessels.map(vessel => (
            <View
              key={vessel.id}
              className={styles.vesselCard}
              onClick={() => handleVesselClick(vessel)}
            >
              <View className={styles.vesselHeader}>
                <View className={styles.vesselInfo}>
                  <View className={styles.vesselIcon}>
                    <Text>{getVesselIcon(vessel.type)}</Text>
                  </View>
                  <View className={styles.vesselNameWrap}>
                    <Text className={styles.vesselName}>{vessel.name}</Text>
                    <Text className={styles.vesselType}>{vessel.type}</Text>
                  </View>
                </View>
                <View className={classnames(styles.vesselStatus, vessel.activeVoyageId ? styles.active : styles.idle)}>
                  {vessel.activeVoyageId ? '航行中' : '待命'}
                </View>
              </View>

              <View className={styles.vesselStats}>
                <View className={styles.vesselStat}>
                  <Text className={styles.vesselStatValue}>
                    {formatFuelAmount(vessel.currentFuelLevel)}
                  </Text>
                  <Text className={styles.vesselStatLabel}>当前存油(吨)</Text>
                </View>
                <View className={styles.vesselStat}>
                  <Text className={classnames(
                    styles.vesselStatValue,
                    vessel.unresolvedAnomalyCount > 0 && styles.warning
                  )}>
                    {vessel.unresolvedAnomalyCount}
                  </Text>
                  <Text className={styles.vesselStatLabel}>未处理异常</Text>
                </View>
                <View className={styles.vesselStat}>
                  <Text className={styles.vesselStatValue}>
                    {vessel.captain ? vessel.captain : '-'}
                  </Text>
                  <Text className={styles.vesselStatLabel}>船长</Text>
                </View>
              </View>

              <View className={styles.vesselBottom}>
                <View className={styles.syncInfo}>
                  <View className={classnames(
                    styles.syncIndicator,
                    !vessel.lastSyncedAt && styles.offline
                  )} />
                  <Text>
                    {vessel.lastSyncedAt 
                      ? `同步于 ${dayjs(vessel.lastSyncedAt).format('MM-DD HH:mm')}`
                      : '暂无同步数据'
                    }
                  </Text>
                </View>
                <View className={styles.viewDetail}>
                  <Text>查看详情</Text>
                  <Text>›</Text>
                </View>
              </View>
            </View>
          ))
        ) : (
          <View className={styles.emptyState}>
            <Text className={styles.emptyIcon}>🚢</Text>
            <Text className={styles.emptyText}>暂无船舶数据</Text>
          </View>
        )}
      </View>
    </ScrollView>
  )
}

export default FleetPage
