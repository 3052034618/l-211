import React, { useState, useCallback, useMemo } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh, useRouter } from '@tarojs/taro'
import classnames from 'classnames'
import styles from './index.module.scss'
import { useVoyageStore } from '@/store/useVoyageStore'
import dayjs from 'dayjs'
import type { SyncRecord, Vessel } from '@/types'

type FilterStatus = 'all' | 'success' | 'partial' | 'failed'

interface OperationTypeMap {
  [key: string]: string
}

const OPERATION_TYPE_MAP: OperationTypeMap = {
  add_refuel: '加油记录',
  update_tank: '油舱更新',
  resolve_anomaly: '异常处理',
  create_voyage: '创建航次',
  confirm_handover: '交接确认',
  add_engine_record: '主机记录',
  add_daily_consumption: '每日油耗'
}

const FILTER_OPTIONS: Array<{ value: FilterStatus; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'success', label: '成功' },
  { value: 'partial', label: '部分成功' },
  { value: 'failed', label: '失败' }
]

const VesselTrackingPage: React.FC = () => {
  const router = useRouter()
  const vesselId = router.params.vesselId || ''
  const vesselName = router.params.vesselName || ''

  const {
    vessels,
    isLoading,
    isOffline,
    loadFleetData,
    loadSyncRecords,
    getVesselById,
    getSyncRecordsByVessel,
    syncOfflineData
  } = useVoyageStore()

  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [expandedRecords, setExpandedRecords] = useState<Set<string>>(new Set())
  const [, setIsRefreshing] = useState(false)

  useDidShow(() => {
    initData()
  })

  usePullDownRefresh(() => {
    handleRefresh()
  })

  const initData = async () => {
    await Promise.all([
      loadFleetData(),
      loadSyncRecords()
    ])
  }

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      if (isOffline) {
        await syncOfflineData()
      }
      await Promise.all([
        loadFleetData(),
        loadSyncRecords()
      ])
    } catch (error) {
      console.error('[VesselTrackingPage] 刷新失败', error)
    } finally {
      setIsRefreshing(false)
      Taro.stopPullDownRefresh()
    }
  }, [loadFleetData, loadSyncRecords, isOffline, syncOfflineData])

  const vessel = useMemo<Vessel | undefined>(() => {
    return getVesselById(vesselId) || vessels.find(v => v.name === vesselName)
  }, [vesselId, vesselName, vessels, getVesselById])

  const syncRecords = useMemo<SyncRecord[]>(() => {
    return getSyncRecordsByVessel(vessel?.id || vesselId)
  }, [vessel, vesselId, getSyncRecordsByVessel])

  const filteredRecords = useMemo<SyncRecord[]>(() => {
    if (filterStatus === 'all') {
      return syncRecords
    }
    return syncRecords.filter(r => r.status === filterStatus)
  }, [syncRecords, filterStatus])

  const stats = useMemo(() => {
    const total = syncRecords.length
    const success = syncRecords.filter(r => r.status === 'success').length
    const failed = syncRecords.filter(r => r.status === 'failed').length
    const partial = syncRecords.filter(r => r.status === 'partial').length

    let avgDuration = 0
    if (syncRecords.length > 0) {
      const totalDuration = syncRecords.reduce((sum, record) => {
        const start = dayjs(record.syncStartedAt).valueOf()
        const end = dayjs(record.syncCompletedAt).valueOf()
        return sum + (end - start)
      }, 0)
      avgDuration = Math.round(totalDuration / syncRecords.length)
    }

    return {
      total,
      success,
      failed,
      partial,
      avgDuration
    }
  }, [syncRecords])

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

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      success: '成功',
      partial: '部分成功',
      failed: '失败'
    }
    return statusMap[status] || status
  }

  const getOperationTypeText = (type: string) => {
    return OPERATION_TYPE_MAP[type] || type
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) {
      return `${ms}ms`
    }
    const seconds = Math.round(ms / 1000)
    if (seconds < 60) {
      return `${seconds}秒`
    }
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}分${remainingSeconds}秒`
  }

  const handleFilterChange = (status: FilterStatus) => {
    setFilterStatus(status)
  }

  const toggleExpand = (recordId: string) => {
    setExpandedRecords(prev => {
      const next = new Set(prev)
      if (next.has(recordId)) {
        next.delete(recordId)
      } else {
        next.add(recordId)
      }
      return next
    })
  }

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
            <View className={styles.vesselMeta}>
              {vessel?.captain && (
                <View className={styles.vesselMetaItem}>
                  <Text>船长：{vessel.captain}</Text>
                </View>
              )}
              {vessel?.chiefEngineer && (
                <View className={styles.vesselMetaItem}>
                  <Text>轮机长：{vessel.chiefEngineer}</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </View>

      <View className={styles.statsSection}>
        <View className={styles.statsGrid}>
          <View className={styles.statCard}>
            <View className={styles.statHeader}>
              <Text className={styles.statLabel}>总同步次数</Text>
              <View className={styles.statIcon}>
                <Text>📊</Text>
              </View>
            </View>
            <Text className={styles.statValue}>{stats.total}</Text>
            <Text className={styles.statSubLabel}>次</Text>
          </View>

          <View className={styles.statCard}>
            <View className={styles.statHeader}>
              <Text className={styles.statLabel}>成功次数</Text>
              <View className={classnames(styles.statIcon, styles.success)}>
                <Text>✅</Text>
              </View>
            </View>
            <Text className={classnames(styles.statValue, styles.success)}>{stats.success}</Text>
            <Text className={styles.statSubLabel}>次</Text>
          </View>

          <View className={styles.statCard}>
            <View className={styles.statHeader}>
              <Text className={styles.statLabel}>失败次数</Text>
              <View className={classnames(styles.statIcon, styles.failed)}>
                <Text>❌</Text>
              </View>
            </View>
            <Text className={classnames(styles.statValue, styles.failed)}>{stats.failed + stats.partial}</Text>
            <Text className={styles.statSubLabel}>次（含部分成功）</Text>
          </View>

          <View className={styles.statCard}>
            <View className={styles.statHeader}>
              <Text className={styles.statLabel}>平均耗时</Text>
              <View className={classnames(styles.statIcon, styles.avg)}>
                <Text>⏱️</Text>
              </View>
            </View>
            <Text className={classnames(styles.statValue, styles.avg)}>{formatDuration(stats.avgDuration)}</Text>
            <Text className={styles.statSubLabel}>次同步</Text>
          </View>
        </View>
      </View>

      <View className={styles.filterSection}>
        {FILTER_OPTIONS.map(option => (
          <View
            key={option.value}
            className={classnames(
              styles.filterItem,
              filterStatus === option.value && styles.active,
              filterStatus === option.value && option.value !== 'all' && styles[option.value]
            )}
            onClick={() => handleFilterChange(option.value)}
          >
            <Text>{option.label}</Text>
          </View>
        ))}
      </View>

      <View className={styles.recordsSection}>
        <View className={styles.sectionHeader}>
          <Text className={styles.sectionTitle}>同步记录</Text>
          <Text className={styles.sectionCount}>
            共 {filteredRecords.length} 条
          </Text>
        </View>

        <ScrollView className={styles.recordList} scrollY>
          {filteredRecords.length > 0 ? (
            filteredRecords.map(record => (
              <View key={record.id} className={styles.recordItem}>
                <View className={styles.recordHeader}>
                  <Text className={styles.recordTime}>
                    {dayjs(record.syncStartedAt).format('YYYY-MM-DD HH:mm:ss')}
                  </Text>
                  <View className={classnames(styles.recordStatus, styles[record.status])}>
                    <Text>{getStatusText(record.status)}</Text>
                  </View>
                </View>

                <View className={styles.recordMeta}>
                  <View className={styles.metaItem}>
                    <Text className={styles.metaLabel}>完成时间：</Text>
                    <Text className={styles.metaValue}>
                      {dayjs(record.syncCompletedAt).format('HH:mm:ss')}
                    </Text>
                  </View>
                  <View className={styles.divider} />
                  <View className={styles.metaItem}>
                    <Text className={styles.metaLabel}>总计：</Text>
                    <Text className={styles.metaValue}>{record.recordCount} 条</Text>
                  </View>
                  <View className={styles.divider} />
                  <View className={styles.metaItem}>
                    <Text className={styles.metaLabel}>成功：</Text>
                    <Text className={classnames(styles.metaValue, styles.success)}>
                      {record.successCount} 条
                    </Text>
                  </View>
                  <View className={styles.divider} />
                  <View className={styles.metaItem}>
                    <Text className={styles.metaLabel}>失败：</Text>
                    <Text className={classnames(styles.metaValue, styles.failed)}>
                      {record.failedCount} 条
                    </Text>
                  </View>
                </View>

                <View className={styles.operationTags}>
                  {record.operationTypes.map((type, index) => (
                    <View key={index} className={styles.operationTag}>
                      <Text>{getOperationTypeText(type)}</Text>
                    </View>
                  ))}
                </View>

                {record.failedRecords && record.failedRecords.length > 0 && (
                  <View
                    className={classnames(
                      styles.expandBtn,
                      expandedRecords.has(record.id) && styles.active
                    )}
                    onClick={() => toggleExpand(record.id)}
                  >
                    <Text>查看失败详情</Text>
                    <Text className={styles.expandIcon}>▼</Text>
                  </View>
                )}

                {expandedRecords.has(record.id) && record.failedRecords && (
                  <View className={styles.failedDetails}>
                    <Text className={styles.failedTitle}>
                      失败记录（{record.failedRecords.length} 条）
                    </Text>
                    {record.failedRecords.map((item, index) => (
                      <View key={index} className={styles.failedItem}>
                        <View className={styles.failedItemHeader}>
                          <Text className={styles.failedType}>
                            {getOperationTypeText(item.type)}
                          </Text>
                        </View>
                        <Text className={styles.failedReason}>{item.reason}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))
          ) : (
            <View className={styles.emptyState}>
              <Text className={styles.emptyIcon}>📋</Text>
              <Text className={styles.emptyText}>暂无同步记录</Text>
              <Text className={styles.emptySubText}>下拉刷新获取最新数据</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </ScrollView>
  )
}

export default VesselTrackingPage
