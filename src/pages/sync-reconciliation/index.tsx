import React, { useState, useCallback, useMemo, useEffect } from 'react'
import { View, Text, ScrollView, Picker } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import styles from './index.module.scss'
import { useVoyageStore } from '@/store/useVoyageStore'
import type { SyncRecord, Vessel, Voyage, OfflineOperationType } from '@/types'
import dayjs from 'dayjs'

const OPERATION_TYPE_MAP: Record<OfflineOperationType | string, string> = {
  add_refuel: '加油记录',
  update_tank: '油舱更新',
  add_anomaly: '新增异常',
  resolve_anomaly: '异常处理',
  create_voyage: '创建航次',
  confirm_handover: '交接确认',
  add_engine_record: '主机记录',
  add_daily_consumption: '每日油耗'
}

const STATUS_TEXT_MAP: Record<SyncRecord['status'], string> = {
  success: '同步成功',
  partial: '部分成功',
  failed: '同步失败'
}

interface TypeStats {
  type: string
  typeName: string
  total: number
  success: number
  failed: number
  retried: number
  isEstimated?: boolean
}

const SyncReconciliationPage: React.FC = () => {
  const {
    user,
    vessels,
    voyageList,
    syncRecords,
    getSyncRecordsByVessel,
    getVesselById,
    getVoyageById,
    loadData,
    loadSyncRecords,
    loadFleetData,
    syncData,
    isLoading
  } = useVoyageStore()

  const [selectedVesselId, setSelectedVesselId] = useState<string>('')
  const [selectedVoyageId, setSelectedVoyageId] = useState<string>('')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null)
  const [, setIsRefreshing] = useState(false)

  useDidShow(() => {
    loadData()
    loadFleetData()
    loadSyncRecords()
  })

  usePullDownRefresh(() => {
    handleRefresh()
  })

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await syncData()
      await loadSyncRecords()
    } catch (error) {
      console.error('[SyncReconciliation] 刷新失败', error)
    } finally {
      setIsRefreshing(false)
      Taro.stopPullDownRefresh()
    }
  }, [syncData, loadSyncRecords])

  const isManager = user?.role === 'manager'

  const vesselOptions = useMemo(() => {
    return [
      { label: '全部船舶', value: '' },
      ...vessels.map(v => ({ label: v.name, value: v.id }))
    ]
  }, [vessels])

  const selectedVessel = useMemo(() => {
    if (!selectedVesselId) return null
    return getVesselById(selectedVesselId)
  }, [selectedVesselId, getVesselById])

  const voyageOptions = useMemo(() => {
    const baseOptions = [{ label: '全部航次', value: '' }]
    if (!selectedVessel) return baseOptions

    const vesselVoyages = voyageList
      .filter(v => v.vesselName === selectedVessel.name)
      .sort((a, b) => dayjs(b.createdAt).valueOf() - dayjs(a.createdAt).valueOf())

    return [
      ...baseOptions,
      ...vesselVoyages.map(v => ({
        label: `${v.fromPort} → ${v.toPort}`,
        value: v.id
      }))
    ]
  }, [selectedVessel, voyageList])

  const filteredRecords = useMemo<SyncRecord[]>(() => {
    let records: SyncRecord[]

    if (selectedVesselId) {
      records = getSyncRecordsByVessel(selectedVesselId)
    } else {
      records = [...syncRecords].sort((a, b) =>
        dayjs(b.syncStartedAt).valueOf() - dayjs(a.syncStartedAt).valueOf()
      )
    }

    if (selectedVoyageId) {
      records = records.filter(r => r.voyageId === selectedVoyageId)
    }

    if (startDate) {
      records = records.filter(r =>
        dayjs(r.syncStartedAt).isAfter(dayjs(startDate).startOf('day'))
      )
    }

    if (endDate) {
      records = records.filter(r =>
        dayjs(r.syncStartedAt).isBefore(dayjs(endDate).endOf('day'))
      )
    }

    return records
  }, [syncRecords, selectedVesselId, selectedVoyageId, startDate, endDate, getSyncRecordsByVessel, getVoyageById])

  const summaryStats = useMemo(() => {
    return filteredRecords.reduce(
      (acc, record) => {
        acc.total += record.recordCount
        acc.success += record.successCount
        acc.failed += record.failedCount
        return acc
      },
      { total: 0, success: 0, failed: 0 }
    )
  }, [filteredRecords])

  const getVoyageInfo = (record: SyncRecord): string => {
    if (record.voyageId) {
      const voyage = getVoyageById(record.voyageId)
      if (voyage) {
        return `${voyage.fromPort} → ${voyage.toPort}`
      }
    }

    const vesselVoyages = voyageList.filter(v => v.vesselName === record.vesselName)
    if (vesselVoyages.length === 0) return '暂无航次'

    const syncTime = dayjs(record.syncStartedAt)
    const matchedVoyage = vesselVoyages.find(v => {
      const departure = dayjs(v.departureDate)
      const arrival = v.arrivalDate ? dayjs(v.arrivalDate) : dayjs()
      return syncTime.isBetween(departure, arrival, null, '[]')
    }) || vesselVoyages[0]

    return `${matchedVoyage.fromPort} → ${matchedVoyage.toPort}`
  }

  const getTypeStats = (record: SyncRecord): TypeStats[] => {
    if (record.perTypeStats && record.perTypeStats.length > 0) {
      return record.perTypeStats.map(stat => ({
        type: stat.type,
        typeName: OPERATION_TYPE_MAP[stat.type] || stat.type,
        total: stat.total,
        success: stat.success,
        failed: stat.failed,
        retried: stat.retried
      }))
    }

    const typeCount = new Map<string, { total: number; success: number; failed: number; retried: number }>()

    record.operationTypes.forEach(type => {
      typeCount.set(type, { total: 0, success: 0, failed: 0, retried: 0 })
    })

    const successPerType = Math.floor(record.successCount / record.operationTypes.length)
    const failedPerType = Math.floor(record.failedCount / record.operationTypes.length)

    record.operationTypes.forEach((type, index) => {
      const stats = typeCount.get(type)!
      const isLast = index === record.operationTypes.length - 1

      if (isLast) {
        stats.success = record.successCount - successPerType * (record.operationTypes.length - 1)
        stats.failed = record.failedCount - failedPerType * (record.operationTypes.length - 1)
      } else {
        stats.success = successPerType
        stats.failed = failedPerType
      }
      stats.total = stats.success + stats.failed

      typeCount.set(type, stats)
    })

    if (record.failedRecords && record.failedRecords.length > 0) {
      record.failedRecords.forEach(failed => {
        const stats = typeCount.get(failed.type)
        if (stats) {
          stats.failed = Math.max(stats.failed, 1)
          if (failed.isRetried) {
            stats.retried += 1
          }
        } else {
          typeCount.set(failed.type, {
            total: 1,
            success: 0,
            failed: 1,
            retried: failed.isRetried ? 1 : 0
          })
        }
      })
    }

    return Array.from(typeCount.entries()).map(([type, stats]) => ({
      type,
      typeName: OPERATION_TYPE_MAP[type] || type,
      ...stats,
      isEstimated: true
    }))
  }

  const handleVesselChange = (e: any) => {
    const vesselId = e.detail.value
    setSelectedVesselId(vesselId)
    setSelectedVoyageId('')
  }

  const handleVoyageChange = (e: any) => {
    setSelectedVoyageId(e.detail.value)
  }

  const handleStartDateChange = (e: any) => {
    setStartDate(e.detail.value)
  }

  const handleEndDateChange = (e: any) => {
    setEndDate(e.detail.value)
  }

  const toggleExpand = (recordId: string) => {
    setExpandedRecordId(expandedRecordId === recordId ? null : recordId)
  }

  useEffect(() => {
    if (!isManager && user) {
      Taro.showToast({
        title: '仅管理人员可访问',
        icon: 'none'
      })
    }
  }, [isManager, user])

  if (!isManager) {
    return (
      <ScrollView className={styles.page} scrollY>
        <View className={styles.noPermission}>
          <Text className={styles.icon}>🔒</Text>
          <Text className={styles.title}>无访问权限</Text>
          <Text className={styles.desc}>该页面仅管理人员可访问</Text>
        </View>
      </ScrollView>
    )
  }

  return (
    <ScrollView className={styles.page} scrollY>
      <View className={styles.filterBar}>
        <View className={styles.filterRow}>
          <View className={styles.filterItem}>
            <Text className={styles.label}>选择船舶</Text>
            <Picker
              mode='selector'
              range={vesselOptions}
              rangeKey='label'
              value={vesselOptions.findIndex(v => v.value === selectedVesselId)}
              onChange={handleVesselChange}
            >
              <View className={styles.selectWrapper}>
                <View className={styles.select}>
                  {selectedVesselId
                    ? vesselOptions.find(v => v.value === selectedVesselId)?.label
                    : '请选择船舶'}
                </View>
                <Text className={styles.arrow}>▼</Text>
              </View>
            </Picker>
          </View>

          <View className={styles.filterItem}>
            <Text className={styles.label}>选择航次</Text>
            <Picker
              mode='selector'
              range={voyageOptions}
              rangeKey='label'
              value={voyageOptions.findIndex(v => v.value === selectedVoyageId)}
              onChange={handleVoyageChange}
              disabled={!selectedVesselId}
            >
              <View className={styles.selectWrapper}>
                <View className={styles.select}>
                  {selectedVoyageId
                    ? voyageOptions.find(v => v.value === selectedVoyageId)?.label
                    : !selectedVesselId
                    ? '请先选择船舶'
                    : '请选择航次'}
                </View>
                <Text className={styles.arrow}>▼</Text>
              </View>
            </Picker>
          </View>
        </View>

        <View className={styles.filterRow}>
          <View className={styles.filterItem}>
            <Text className={styles.label}>开始日期</Text>
            <Picker
              mode='date'
              value={startDate}
              onChange={handleStartDateChange}
            >
              <View className={styles.dateInput}>
                {startDate || '请选择日期'}
              </View>
            </Picker>
          </View>

          <View className={styles.filterItem}>
            <Text className={styles.label}>结束日期</Text>
            <Picker
              mode='date'
              value={endDate}
              onChange={handleEndDateChange}
              end={dayjs().format('YYYY-MM-DD')}
            >
              <View className={styles.dateInput}>
                {endDate || '请选择日期'}
              </View>
            </Picker>
          </View>
        </View>
      </View>

      <View className={styles.summaryBar}>
        <View className={styles.statItem}>
          <Text className={styles.statValue}>{summaryStats.total}</Text>
          <Text className={styles.statLabel}>总记录数</Text>
        </View>
        <View className={styles.divider} />
        <View className={styles.statItem}>
          <Text className={styles.statValue}>{summaryStats.success}</Text>
          <Text className={styles.statLabel}>成功</Text>
        </View>
        <View className={styles.divider} />
        <View className={styles.statItem}>
          <Text className={styles.statValue}>{summaryStats.failed}</Text>
          <Text className={styles.statLabel}>失败</Text>
        </View>
      </View>

      {isLoading ? (
        <View className={styles.loading}>
          <Text>⏳</Text>
          <Text className={styles.text}>加载中...</Text>
        </View>
      ) : (
        <View className={styles.recordList}>
          {filteredRecords.length > 0 ? (
            <>
              {filteredRecords.map(record => (
                <View key={record.id} className={styles.recordCard}>
                  <View className={styles.cardHeader}>
                    <View className={styles.headerLeft}>
                      <Text className={styles.batchId}>批次号: {record.id}</Text>
                      <Text className={styles.syncTime}>
                        同步时间: {dayjs(record.syncCompletedAt).format('YYYY-MM-DD HH:mm:ss')}
                      </Text>
                    </View>
                    <View className={`${styles.statusBadge} ${styles[record.status]}`}>
                      <Text>{STATUS_TEXT_MAP[record.status]}</Text>
                    </View>
                  </View>

                  <View className={styles.cardBody}>
                    <View className={styles.infoGrid}>
                      <View className={styles.infoItem}>
                        <Text className={styles.label}>船舶名称</Text>
                        <Text className={styles.value}>{record.vesselName}</Text>
                      </View>
                      <View className={styles.infoItem}>
                        <Text className={styles.label}>所属航次</Text>
                        <View className={styles.voyageRoute}>
                          <Text>{getVoyageInfo(record)}</Text>
                        </View>
                      </View>
                    </View>

                    <View className={styles.statsRow}>
                      <View className={styles.stat}>
                        <Text className={`${styles.num} ${styles.total}`}>{record.recordCount}</Text>
                        <Text className={styles.label}>总计</Text>
                      </View>
                      <View className={styles.stat}>
                        <Text className={`${styles.num} ${styles.success}`}>{record.successCount}</Text>
                        <Text className={styles.label}>成功</Text>
                      </View>
                      <View className={styles.stat}>
                        <Text className={`${styles.num} ${styles.failed}`}>{record.failedCount}</Text>
                        <Text className={styles.label}>失败</Text>
                      </View>
                    </View>

                    <View className={styles.typeTags}>
                      {getTypeStats(record).map(typeStat => (
                        <Text key={typeStat.type} className={styles.typeTag}>
                          {typeStat.typeName} × {typeStat.total}
                        </Text>
                      ))}
                    </View>
                  </View>

                  <View
                    className={styles.expandBtn}
                    onClick={() => toggleExpand(record.id)}
                  >
                    <Text className={`${styles.icon} ${expandedRecordId === record.id ? styles.expanded : ''}`}>
                      ▼
                    </Text>
                    <Text>{expandedRecordId === record.id ? '收起详情' : '展开详情'}</Text>
                  </View>

                  {expandedRecordId === record.id && (
                    <View className={styles.detailPanel}>
                      <View className={styles.detailSection}>
                        <Text className={styles.sectionTitle}>同步时间对比</Text>
                        <View className={styles.timeCompare}>
                          <View className={styles.timeBox}>
                            <Text className={styles.label}>船端开始时间</Text>
                            <Text className={styles.value}>
                              {dayjs(record.syncStartedAt).format('YYYY-MM-DD HH:mm:ss')}
                            </Text>
                          </View>
                          <Text className={styles.arrow}>→</Text>
                          <View className={styles.timeBox}>
                            <Text className={styles.label}>管理端接收时间</Text>
                            <Text className={styles.value}>
                              {dayjs(record.syncCompletedAt).format('YYYY-MM-DD HH:mm:ss')}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {record.operationTypes.includes('confirm_handover') && (
                        <View className={styles.detailSection}>
                          <Text className={styles.sectionTitle}>交接状态</Text>
                          <View className={styles.handoverStatus}>
                            <Text className={styles.handoverText}>
                              该批次包含交接确认操作，交接单最终状态：已确认
                            </Text>
                          </View>
                        </View>
                      )}

                      <View className={styles.detailSection}>
                        <Text className={styles.sectionTitle}>各类型记录详情</Text>
                        <View className={styles.typeDetailList}>
                          {getTypeStats(record).map(typeStat => (
                            <View key={typeStat.type} className={styles.typeDetailItem}>
                              <Text className={styles.typeName}>{typeStat.typeName}</Text>
                              <View className={styles.typeCounts}>
                                <Text className={`${styles.count} ${styles.success}`}>
                                  成功 {typeStat.success}
                                </Text>
                                {typeStat.retried > 0 && (
                                  <Text className={`${styles.count} ${styles.success}`}>
                                    重传成功 {typeStat.retried}
                                  </Text>
                                )}
                                <Text className={`${styles.count} ${styles.failed}`}>
                                  失败 {typeStat.failed}
                                </Text>
                              </View>
                            </View>
                          ))}
                        </View>
                      </View>

                      {record.failedRecords && record.failedRecords.length > 0 && (
                        <View className={styles.detailSection}>
                          <Text className={styles.sectionTitle}>失败记录详情</Text>
                          <View className={styles.failedList}>
                            {record.failedRecords.map((failed, index) => (
                              <View key={`${failed.id}-${index}`} className={styles.failedItem}>
                                <View className={styles.failedHeader}>
                                  <Text className={styles.failedType}>
                                    {OPERATION_TYPE_MAP[failed.type] || failed.type}
                                    {failed.isRetried && (
                                      <Text className={styles.retryBadge}> 重传仍失败</Text>
                                    )}
                                  </Text>
                                  <Text className={styles.recordId}>{failed.id.slice(-8)}</Text>
                                </View>
                                <Text className={styles.failedReason}>
                                  失败原因: {failed.reason}
                                </Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              ))}

              <View className={styles.loadMore}>
                <Text>— 已加载全部 {filteredRecords.length} 条记录 —</Text>
              </View>
            </>
          ) : (
            <View className={styles.emptyState}>
              <Text className={styles.icon}>📋</Text>
              <Text className={styles.title}>暂无同步记录</Text>
              <Text className={styles.desc}>
                {(selectedVesselId || startDate || endDate)
                  ? '当前筛选条件下暂无记录'
                  : '暂无同步对账数据'}
              </Text>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  )
}

export default SyncReconciliationPage
