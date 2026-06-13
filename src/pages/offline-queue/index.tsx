import React, { useState, useMemo, useCallback } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import styles from './index.module.scss'
import { useVoyageStore } from '@/store/useVoyageStore'
import type { OfflineQueueItem, OfflineQueueStatus, OfflineOperationType } from '@/types'
import dayjs from 'dayjs'

const OPERATION_TYPE_MAP: Record<OfflineOperationType, string> = {
  add_refuel: '加油记录',
  update_tank: '油舱更新',
  resolve_anomaly: '异常处理',
  add_anomaly: '新增异常',
  create_voyage: '创建航次',
  confirm_handover: '交接确认',
  add_engine_record: '主机记录',
  add_daily_consumption: '每日油耗'
}

const STATUS_TEXT_MAP: Record<OfflineQueueStatus, string> = {
  pending: '待同步',
  syncing: '同步中',
  success: '同步成功',
  failed: '同步失败'
}

const FILTERS = [
  { key: 'all' as const, label: '全部' },
  { key: 'pending' as const, label: '待同步' },
  { key: 'failed' as const, label: '失败' }
]

const OfflineQueuePage: React.FC = () => {
  const {
    offlineQueue,
    isSyncing,
    syncProgress,
    syncOfflineData,
    retryOfflineItem,
    removeFromOfflineQueue,
    loadData,
    syncData
  } = useVoyageStore()

  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'failed'>('all')
  const [, setIsRefreshing] = useState(false)

  useDidShow(() => {
    loadData()
  })

  usePullDownRefresh(() => {
    handleRefresh()
  })

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await syncData()
      await loadData()
    } catch (error) {
      console.error('[OfflineQueue] 刷新失败', error)
    } finally {
      setIsRefreshing(false)
      Taro.stopPullDownRefresh()
    }
  }, [syncData, loadData])

  const stats = useMemo(() => {
    return {
      pending: offlineQueue.filter(item => item.status === 'pending').length,
      syncing: offlineQueue.filter(item => item.status === 'syncing').length,
      success: offlineQueue.filter(item => item.status === 'success').length,
      failed: offlineQueue.filter(item => item.status === 'failed').length
    }
  }, [offlineQueue])

  const filteredQueue = useMemo(() => {
    return offlineQueue.filter(item => {
      if (activeFilter === 'pending') return item.status === 'pending' || item.status === 'syncing'
      if (activeFilter === 'failed') return item.status === 'failed'
      return true
    }).sort((a, b) => dayjs(b.createdAt).valueOf() - dayjs(a.createdAt).valueOf())
  }, [offlineQueue, activeFilter])

  const handleSyncAll = useCallback(async () => {
    if (isSyncing) return
    await syncOfflineData()
  }, [isSyncing, syncOfflineData])

  const handleRetry = useCallback(async (itemId: string) => {
    if (isSyncing) return
    await retryOfflineItem(itemId)
  }, [isSyncing, retryOfflineItem])

  const handleClearSuccess = useCallback(() => {
    const successItems = offlineQueue.filter(item => item.status === 'success')
    if (successItems.length === 0) {
      Taro.showToast({ title: '暂无可清除的记录', icon: 'none' })
      return
    }
    Taro.showModal({
      title: '清除已同步记录',
      content: `确定要清除所有已同步成功的 ${successItems.length} 条记录吗？`,
      success: (res) => {
        if (res.confirm) {
          successItems.forEach(item => removeFromOfflineQueue(item.id))
          Taro.showToast({ title: '已清除', icon: 'success' })
        }
      }
    })
  }, [offlineQueue, removeFromOfflineQueue])

  const getOperationText = (type: OfflineOperationType) => {
    return OPERATION_TYPE_MAP[type] || type
  }

  const getVoyageInfo = (item: OfflineQueueItem) => {
    const voyage = useVoyageStore.getState().getVoyageById(item.voyageId)
    if (voyage) {
      return `${voyage.fromPort} → ${voyage.toPort}`
    }
    return item.vesselName || '未知航次'
  }

  return (
    <ScrollView className={styles.page} scrollY>
      {isSyncing && (
        <View className={styles.syncProgress}>
          <View
            className={styles.progressBar}
            style={{ width: `${syncProgress}%` }}
          />
        </View>
      )}

      <View className={styles.header}>
        <Text className={styles.title}>离线队列</Text>
        <Text className={styles.subtitle}>管理待同步的离线数据</Text>
      </View>

      <View className={styles.actionBar}>
        <View
          className={`${styles.btn} ${styles.primary}`}
          onClick={handleSyncAll}
          disabled={isSyncing || stats.pending === 0}
        >
          <Text className={styles.icon}>🔄</Text>
          <Text>{isSyncing ? '同步中...' : '一键同步'}</Text>
        </View>
        <View
          className={`${styles.btn} ${styles.secondary}`}
          onClick={handleClearSuccess}
          disabled={isSyncing}
        >
          <Text className={styles.icon}>🗑️</Text>
          <Text>清除成功</Text>
        </View>
      </View>

      <View className={styles.statSummary}>
        <View className={styles.statItem}>
          <Text className={`${styles.statValue} ${styles.pending}`}>{stats.pending}</Text>
          <Text className={styles.statLabel}>待同步</Text>
        </View>
        <View className={styles.statItem}>
          <Text className={`${styles.statValue} ${styles.syncing}`}>{stats.syncing}</Text>
          <Text className={styles.statLabel}>同步中</Text>
        </View>
        <View className={styles.statItem}>
          <Text className={`${styles.statValue} ${styles.success}`}>{stats.success}</Text>
          <Text className={styles.statLabel}>成功</Text>
        </View>
        <View className={styles.statItem}>
          <Text className={`${styles.statValue} ${styles.failed}`}>{stats.failed}</Text>
          <Text className={styles.statLabel}>失败</Text>
        </View>
      </View>

      <View className={styles.filterTabs}>
        {FILTERS.map(f => (
          <View
            key={f.key}
            className={`${styles.filterTab} ${activeFilter === f.key ? styles.active : ''}`}
            onClick={() => setActiveFilter(f.key)}
          >
            <Text>{f.label}</Text>
          </View>
        ))}
      </View>

      <View className={styles.queueList}>
        {filteredQueue.length > 0 ? (
          filteredQueue.map(item => (
            <View key={item.id} className={`${styles.queueCard} ${styles[item.status]}`}>
              <View className={styles.cardHeader}>
                <View className={styles.operationInfo}>
                  <Text className={styles.operationType}>
                    {getOperationText(item.type)}
                  </Text>
                  <Text className={styles.voyageInfo}>
                    {getVoyageInfo(item)}
                  </Text>
                </View>
                <View className={`${styles.statusBadge} ${styles[item.status]}`}>
                  <Text>{STATUS_TEXT_MAP[item.status]}</Text>
                </View>
              </View>

              <View className={styles.cardBody}>
                <View className={styles.infoRow}>
                  <Text className={styles.label}>创建时间</Text>
                  <Text className={styles.value}>
                    {dayjs(item.createdAt).format('YYYY-MM-DD HH:mm')}
                  </Text>
                </View>
                <View className={styles.infoRow}>
                  <Text className={styles.label}>重试次数</Text>
                  <Text className={styles.value}>
                    {item.retryCount > 0 && (
                    <Text className={styles.retryBadge}>已重试 {item.retryCount} 次</Text>
                  )}
                    {item.retryCount === 0 && '未重试'}
                  </Text>
                </View>
                {item.status === 'failed' && item.failedReason && (
                  <View className={styles.failedReason}>
                    <Text className={styles.reasonTitle}>失败原因</Text>
                    <Text className={styles.reasonText}>{item.failedReason}</Text>
                  </View>
                )}
              </View>

              <View className={styles.cardFooter}>
                <Text className={styles.timeInfo}>
                  {item.syncedAt
                    ? `同步时间：${dayjs(item.syncedAt).format('YYYY-MM-DD HH:mm')}`
                    : `创建于：${dayjs(item.createdAt).format('YYYY-MM-DD HH:mm')}`
                  }
                </Text>
                {item.status === 'failed' && (
                  <View
                    className={styles.retryBtn}
                    onClick={() => handleRetry(item.id)}
                    disabled={isSyncing}
                  >
                    <Text>重试</Text>
                  </View>
                )}
              </View>
            </View>
          ))
        ) : (
          <View className={styles.emptyState}>
            <Text className={styles.icon}>📋</Text>
            <Text className={styles.title}>暂无离线记录</Text>
            <Text className={styles.subtitle}>
              {activeFilter === 'all'
                ? '所有数据已同步完成'
                : '当前筛选条件下暂无记录'}
            </Text>
          </View>
        )}

        {filteredQueue.length > 0 && (
          <View className={styles.loadMore}>
            <Text>— 已加载全部 {filteredQueue.length} 条记录 —</Text>
          </View>
        )}
      </View>
    </ScrollView>
  )
}

export default OfflineQueuePage
