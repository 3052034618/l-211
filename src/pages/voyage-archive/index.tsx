import React, { useState, useMemo, useCallback } from 'react'
import { View, Text, ScrollView, Button } from '@tarojs/components'
import Taro, { useRouter, useDidShow, usePullDownRefresh } from '@tarojs/taro'
import classnames from 'classnames'
import styles from './index.module.scss'
import { useVoyageStore } from '@/store/useVoyageStore'
import type { Voyage, Tank, RefuelRecord, EngineRecord, DailyConsumption, AnomalyRecord, HandoverReport } from '@/types'
import dayjs from 'dayjs'

type TimelineNodeType = 'tank' | 'refuel' | 'engine' | 'consumption' | 'anomaly' | 'anomalyResolved' | 'handover'

type SortOrder = 'desc' | 'asc'

type FilterType = 'all' | TimelineNodeType

interface TimelineNode {
  id: string
  type: TimelineNodeType
  timestamp: number
  time: string
  icon: string
  title: string
  description: string
  data: Record<string, string | number>
  operator: string
  rawData: any
}

const NODE_CONFIG: Record<TimelineNodeType, { icon: string; title: string }> = {
  tank: { icon: '🛢️', title: '油舱记录' },
  refuel: { icon: '⛽', title: '加油记录' },
  engine: { icon: '⚙️', title: '主机记录' },
  consumption: { icon: '📊', title: '油耗记录' },
  anomaly: { icon: '⚠️', title: '异常记录' },
  anomalyResolved: { icon: '✅', title: '异常处理' },
  handover: { icon: '📋', title: '交接单' }
}

const FILTER_OPTIONS: Array<{ key: FilterType; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'tank', label: '油舱' },
  { key: 'refuel', label: '加油' },
  { key: 'engine', label: '主机' },
  { key: 'consumption', label: '油耗' },
  { key: 'anomaly', label: '异常' },
  { key: 'anomalyResolved', label: '异常处理' },
  { key: 'handover', label: '交接单' }
]

const VoyageArchivePage: React.FC = () => {
  const router = useRouter()
  const { getVoyageById, syncData, loadData } = useVoyageStore()

  const [voyage, setVoyage] = useState<Voyage | null>(null)
  const [, setIsRefreshing] = useState(false)
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [activeFilter, setActiveFilter] = useState<FilterType>('all')
  const [detailModalVisible, setDetailModalVisible] = useState(false)
  const [selectedNode, setSelectedNode] = useState<TimelineNode | null>(null)

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
      console.error('[VoyageArchive] 刷新失败', error)
      Taro.showToast({ title: '刷新失败', icon: 'none' })
    } finally {
      setIsRefreshing(false)
      Taro.stopPullDownRefresh()
    }
  }, [syncData])

  const timelineNodes = useMemo<TimelineNode[]>(() => {
    if (!voyage) return []

    const nodes: TimelineNode[] = []

    voyage.tanks.forEach((tank: Tank) => {
      if (tank.lastUpdate) {
        nodes.push({
          id: `tank_${tank.id}`,
          type: 'tank',
          timestamp: dayjs(tank.lastUpdate).valueOf(),
          time: tank.lastUpdate,
          icon: NODE_CONFIG.tank.icon,
          title: `${tank.name} 存量更新`,
          description: `油舱"${tank.name}"存量已更新`,
          data: {
            '油舱名称': tank.name,
            '油品类型': tank.fuelType,
            '当前存量': `${tank.currentLevel.toFixed(2)} 吨`,
            '油舱容量': `${tank.capacity} 吨`,
            '装载率': `${((tank.currentLevel / tank.capacity) * 100).toFixed(1)}%`
          },
          operator: voyage.chiefEngineer || '轮机员',
          rawData: tank
        })
      }
    })

    voyage.refuelRecords.forEach((record: RefuelRecord) => {
      nodes.push({
        id: `refuel_${record.id}`,
        type: 'refuel',
        timestamp: dayjs(record.createdAt || record.date).valueOf(),
        time: record.createdAt || record.date,
        icon: NODE_CONFIG.refuel.icon,
        title: `${record.port} 加油`,
        description: `在 ${record.port} 港口为"${record.tankName}"加油`,
        data: {
          '加油港口': record.port,
          '加油舱': record.tankName,
          '油品类型': record.fuelType,
          '加油数量': `${record.quantity.toFixed(2)} 吨`,
          '单价': `¥${record.unitPrice.toLocaleString()} 元/吨`,
          '总金额': `¥${record.totalAmount.toLocaleString()} 元`,
          '供应商': record.supplier
        },
        operator: record.operator,
        rawData: record
      })
    })

    voyage.engineRecords.forEach((record: EngineRecord) => {
      nodes.push({
        id: `engine_${record.id}`,
        type: 'engine',
        timestamp: dayjs(record.createdAt || record.date).valueOf(),
        time: record.createdAt || record.date,
        icon: NODE_CONFIG.engine.icon,
        title: '主机运行记录',
        description: `主机运行 ${record.engineHours} 小时`,
        data: {
          '运行时长': `${record.engineHours} 小时`,
          '转速': `${record.rpm} RPM`,
          '功率': `${record.power} kW`,
          '燃油消耗': `${record.fuelConsumption.toFixed(2)} 吨`,
          '航速': `${record.speed.toFixed(1)} 节`,
          '天气': record.weather,
          '风速': `${record.windSpeed} m/s`,
          '浪高': `${record.waveHeight.toFixed(1)} m`
        },
        operator: record.operator,
        rawData: record
      })
    })

    voyage.dailyConsumptions.forEach((record: DailyConsumption) => {
      nodes.push({
        id: `consumption_${record.id}`,
        type: 'consumption',
        timestamp: dayjs(record.date).valueOf(),
        time: record.date,
        icon: NODE_CONFIG.consumption.icon,
        title: `${record.date} 油耗`,
        description: `当日消耗 ${record.consumed.toFixed(2)} 吨燃油`,
        data: {
          '油品类型': record.fuelType,
          '期初存量': `${record.startLevel.toFixed(2)} 吨`,
          '期末存量': `${record.endLevel.toFixed(2)} 吨`,
          '当日加油': `${record.refueled.toFixed(2)} 吨`,
          '当日消耗': `${record.consumed.toFixed(2)} 吨`,
          '主机运行': `${record.engineHours} 小时`,
          '航行距离': `${record.distance.toFixed(1)} 海里`,
          '平均航速': `${record.avgSpeed.toFixed(1)} 节`,
          '天气': record.weather
        },
        operator: voyage.chiefEngineer || '轮机员',
        rawData: record
      })
    })

    voyage.anomalies.forEach((anomaly: AnomalyRecord) => {
      nodes.push({
        id: `anomaly_${anomaly.id}`,
        type: anomaly.isResolved ? 'anomalyResolved' : 'anomaly',
        timestamp: dayjs(anomaly.isResolved && anomaly.resolvedAt ? anomaly.resolvedAt : anomaly.date).valueOf(),
        time: anomaly.isResolved && anomaly.resolvedAt ? anomaly.resolvedAt : anomaly.date,
        icon: anomaly.isResolved ? NODE_CONFIG.anomalyResolved.icon : NODE_CONFIG.anomaly.icon,
        title: anomaly.isResolved ? '异常已处理' : anomaly.description,
        description: anomaly.isResolved 
          ? `异常"${anomaly.description}"已处理` 
          : `检测到异常: ${anomaly.description}`,
        data: {
          '异常类型': anomaly.type === 'consumption' ? '油耗异常' : anomaly.type === 'tank_level' ? '油舱存量异常' : '主机运行异常',
          '异常等级': anomaly.severity === 'high' ? '严重' : anomaly.severity === 'medium' ? '中度' : '轻微',
          '期望值': `${anomaly.expectedValue.toFixed(2)}`,
          '实际值': `${anomaly.actualValue.toFixed(2)}`,
          '偏差': `${anomaly.deviation.toFixed(1)}%`,
          ...(anomaly.isResolved ? {
            '处理说明': anomaly.resolution || '',
            '处理人': anomaly.resolvedBy || '',
            '处理时间': anomaly.resolvedAt ? dayjs(anomaly.resolvedAt).format('YYYY-MM-DD HH:mm') : ''
          } : {})
        },
        operator: anomaly.isResolved ? anomaly.resolvedBy || '' : voyage.chiefEngineer || '系统',
        rawData: anomaly
      })
    })

    if (voyage.handoverReport) {
      const report = voyage.handoverReport
      nodes.push({
        id: `handover_${report.id}`,
        type: 'handover',
        timestamp: dayjs(report.confirmedAt || report.arrivalDate || voyage.updatedAt).valueOf(),
        time: report.confirmedAt || report.arrivalDate || voyage.updatedAt,
        icon: NODE_CONFIG.handover.icon,
        title: report.status === 'confirmed' ? '交接单已确认' : '交接单已生成',
        description: report.status === 'confirmed' 
          ? `交接单已由 ${report.confirmedBy} 确认` 
          : '航次交接单已生成',
        data: {
          '单据编号': report.id,
          '总耗油量': `${report.totalFuelConsumed.toFixed(2)} 吨`,
          '总加油量': `${report.totalRefueled.toFixed(2)} 吨`,
          '日均油耗': `${report.avgDailyConsumption.toFixed(2)} 吨/天`,
          '制表人': report.preparedBy,
          ...(report.confirmedBy ? {
            '确认人': report.confirmedBy,
            '确认时间': report.confirmedAt ? dayjs(report.confirmedAt).format('YYYY-MM-DD HH:mm') : ''
          } : {})
        },
        operator: report.confirmedBy || report.preparedBy,
        rawData: report
      })
    }

    return nodes.sort((a, b) => {
      return sortOrder === 'desc' ? b.timestamp - a.timestamp : a.timestamp - b.timestamp
    })
  }, [voyage, sortOrder])

  const filteredNodes = useMemo(() => {
    if (activeFilter === 'all') return timelineNodes
    return timelineNodes.filter(node => node.type === activeFilter)
  }, [timelineNodes, activeFilter])

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      active: '航行中',
      completed: '已完成',
      draft: '草稿'
    }
    return statusMap[status] || status
  }

  const handleNodeClick = (node: TimelineNode) => {
    switch (node.type) {
      case 'tank':
        Taro.navigateTo({
          url: `/pages/tank-snapshot/index?voyageId=${voyageId}`
        })
        break
      case 'refuel':
        Taro.navigateTo({
          url: `/pages/refuel-detail/index?id=${node.rawData.id}`
        })
        break
      case 'anomaly':
      case 'anomalyResolved':
        Taro.navigateTo({
          url: `/pages/anomaly-detail/index?id=${node.rawData.id}`
        })
        break
      case 'handover':
        Taro.navigateTo({
          url: `/pages/handover-preview/index?id=${voyageId}`
        })
        break
      case 'engine':
      case 'consumption':
        setSelectedNode(node)
        setDetailModalVisible(true)
        break
      default:
        break
    }
  }

  const getEmptyTypes = useMemo(() => {
    if (!voyage) return []
    const emptyTypes: Array<{ type: TimelineNodeType; text: string }> = []

    if (voyage.tanks.length === 0 || !voyage.tanks.some(t => t.lastUpdate)) {
      emptyTypes.push({ type: 'tank', text: '暂无油舱存量记录' })
    }
    if (voyage.refuelRecords.length === 0) {
      emptyTypes.push({ type: 'refuel', text: '暂无港口加油记录' })
    }
    if (voyage.engineRecords.length === 0) {
      emptyTypes.push({ type: 'engine', text: '暂无主机运行记录' })
    }
    if (voyage.dailyConsumptions.length === 0) {
      emptyTypes.push({ type: 'consumption', text: '暂无每日油耗记录' })
    }
    if (voyage.anomalies.length === 0) {
      emptyTypes.push({ type: 'anomaly', text: '暂无油耗异常记录' })
    }
    if (!voyage.handoverReport) {
      emptyTypes.push({ type: 'handover', text: '暂无交接单记录' })
    }

    return emptyTypes
  }, [voyage])

  const renderDataTags = (data: Record<string, string | number>) => {
    const entries = Object.entries(data).slice(0, 4)
    return entries.map(([key, value]) => (
      <View key={key} className={styles.dataTag}>
        <Text>{key}</Text>
        <Text className={styles.dataValue}>{value}</Text>
      </View>
    ))
  }

  const renderDetailModal = () => {
    if (!detailModalVisible || !selectedNode) {
      return null
    }

    return (
      <View className={styles.modalOverlay} onClick={() => setDetailModalVisible(false)}>
        <View className={styles.modalContent} onClick={e => e.stopPropagation()}>
          <View className={styles.modalHeader}>
            <Text className={styles.modalTitle}>{selectedNode.title}</Text>
            <Text className={styles.modalClose} onClick={() => setDetailModalVisible(false)}>×</Text>
          </View>
          <View className={styles.modalBody}>
            <View className={styles.detailSection}>
              <Text className={styles.detailLabel}>操作时间</Text>
              <Text className={styles.detailValue}>
                {dayjs(selectedNode.time).format('YYYY-MM-DD HH:mm:ss')}
              </Text>
            </View>
            <View className={styles.detailSection}>
              <Text className={styles.detailLabel}>操作类型</Text>
              <Text className={styles.detailValue}>
                {selectedNode.icon} {NODE_CONFIG[selectedNode.type].title}
              </Text>
            </View>
            {Object.entries(selectedNode.data).map(([key, value]) => (
              <View key={key} className={styles.detailRow}>
                <Text className={styles.detailLabel}>{key}</Text>
                <Text className={styles.detailValue}>{value}</Text>
              </View>
            ))}
            <View className={styles.detailSection}>
              <Text className={styles.detailLabel}>操作人</Text>
              <Text className={styles.detailValue}>{selectedNode.operator}</Text>
            </View>
          </View>
          <View className={styles.modalFooter}>
            <Button className={styles.confirmBtn} onClick={() => setDetailModalVisible(false)}>
              关闭
            </Button>
          </View>
        </View>
      </View>
    )
  }

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
        <View className={styles.route}>
          <Text className={styles.routePort}>{voyage.fromPort}</Text>
          <Text className={styles.routeArrow}>→</Text>
          <Text className={styles.routePort}>{voyage.toPort}</Text>
        </View>
        <Text className={styles.vesselInfo}>
          {voyage.vesselName} · {voyage.vesselType}
        </Text>
        <Text className={styles.dateInfo}>
          {dayjs(voyage.departureDate).format('YYYY-MM-DD')}
          {voyage.arrivalDate && ` ~ ${dayjs(voyage.arrivalDate).format('YYYY-MM-DD')}`}
        </Text>
        <View className={styles.statusBadge}>
          <Text>{getStatusText(voyage.status)}</Text>
        </View>
      </View>

      <View className={styles.filterSection}>
        <View className={styles.sectionHeader}>
          <Text className={styles.sectionTitle}>时间线</Text>
          <View className={styles.sortToggle} onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}>
            <Text className={styles.sortIcon}>{sortOrder === 'desc' ? '↓' : '↑'}</Text>
            <Text>{sortOrder === 'desc' ? '倒序' : '正序'}</Text>
          </View>
        </View>
        <ScrollView className={styles.filterTabs} scrollX enableFlex>
          {FILTER_OPTIONS.map(option => (
            <View
              key={option.key}
              className={classnames(styles.filterTab, { [styles.active]: activeFilter === option.key })}
              onClick={() => setActiveFilter(option.key)}
            >
              <Text>{option.label}</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      <View className={styles.timelineSection}>
        <View className={styles.sectionHeader}>
          <Text className={styles.sectionTitle}>操作记录</Text>
          <Text className={styles.sectionCount}>共 {filteredNodes.length} 条</Text>
        </View>

        {filteredNodes.length > 0 ? (
          <View className={styles.timeline}>
            {filteredNodes.map(node => (
              <View
              key={node.id}
              className={styles.timelineItem}
              onClick={() => handleNodeClick(node)}
            >
              <View className={classnames(styles.timelineDot, styles[node.type])} />
              <View className={styles.timelineHeader}>
                <Text className={styles.timelineIcon}>{node.icon}</Text>
                <Text className={styles.timelineTime}>
                  {dayjs(node.time).format('MM-DD HH:mm')}
                </Text>
              </View>
              <View className={styles.timelineContent}>
                <Text className={styles.timelineTitle}>{node.title}</Text>
                <Text className={styles.timelineDesc}>{node.description}</Text>
              </View>
              <View className={styles.timelineData}>
                {renderDataTags(node.data)}
              </View>
              <View className={styles.timelineFooter}>
                <Text className={styles.operator}>操作人: {node.operator}</Text>
                <Text className={styles.viewDetail}>查看详情 ›</Text>
              </View>
            </View>
          ))}
          </View>
        ) : (
          <View className={styles.emptyState}>
            {timelineNodes.length === 0 ? (
              <>
                <Text className={styles.emptyIcon}>📋</Text>
                <Text className={styles.emptyText}>暂无记录</Text>
                <Text className={styles.emptyDesc}>本航次暂无任何操作记录</Text>
                {getEmptyTypes.length > 0 && (
                  <View className={styles.typeEmptyList}>
                    {getEmptyTypes.map(item => (
                    <View key={item.type} className={styles.typeEmptyItem}>
                      <Text className={styles.typeEmptyIcon}>
                        {NODE_CONFIG[item.type].icon}
                      </Text>
                      <Text className={styles.typeEmptyText}>{item.text}</Text>
                    </View>
                  ))}
                  </View>
                )}
              </>
            ) : (
              <>
                <Text className={styles.emptyIcon}>🔍</Text>
                <Text className={styles.emptyText}>暂无相关记录</Text>
                <Text className={styles.emptyDesc}>当前筛选条件下暂无记录</Text>
              </>
            )}
          </View>
        )}
      </View>

      {renderDetailModal()}
    </ScrollView>
  )
}

export default VoyageArchivePage
