import React, { useState, useMemo, useCallback } from 'react'
import { View, Text, ScrollView, Input } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import styles from './index.module.scss'
import { useVoyageStore } from '@/store/useVoyageStore'
import { mockVoyageList, mockUser } from '@/data/mockData'
import type { Voyage, VoyageStatus } from '@/types'
import dayjs from 'dayjs'

const HistoryPage: React.FC = () => {
  const { voyageList, setVoyageList, setCurrentVoyage, user, setUser, loadData, syncData } = useVoyageStore()
  const [searchText, setSearchText] = useState('')
  const [activeFilter, setActiveFilter] = useState<VoyageStatus | 'all'>('all')
  const [, setIsRefreshing] = useState(false)

  useDidShow(() => {
    initData()
  })

  usePullDownRefresh(() => {
    handleRefresh()
  })

  const initData = async () => {
    await loadData()
    if (!user) setUser(mockUser)
    if (voyageList.length === 0) setVoyageList(mockVoyageList)
  }

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await syncData()
      await initData()
    } catch (error) {
      console.error('[History] 刷新失败', error)
    } finally {
      setIsRefreshing(false)
      Taro.stopPullDownRefresh()
    }
  }, [syncData, initData])

  const filteredVoyages = useMemo(() => {
    return voyageList.filter(v => {
      const matchStatus = activeFilter === 'all' || v.status === activeFilter
      const matchSearch = !searchText ||
        v.vesselName.includes(searchText) ||
        v.fromPort.includes(searchText) ||
        v.toPort.includes(searchText)
      return matchStatus && matchSearch
    }).sort((a, b) => dayjs(b.createdAt).valueOf() - dayjs(a.createdAt).valueOf())
  }, [voyageList, activeFilter, searchText])

  const stats = useMemo(() => {
    const completed = voyageList.filter(v => v.status === 'completed')
    const totalDistance = completed.reduce((sum, v) => sum + (v.totalDistance || 0), 0)
    const totalFuel = completed.reduce((sum, v) => sum + (v.totalFuelConsumed || 0), 0)

    return {
      totalVoyages: completed.length,
      totalDistance: totalDistance.toFixed(0),
      totalFuel: totalFuel.toFixed(1)
    }
  }, [voyageList])

  const getPortSummary = (voyage: Voyage) => {
    const portMap = new Map<string, number>()
    voyage.refuelRecords.forEach(r => {
      const current = portMap.get(r.port) || 0
      portMap.set(r.port, current + r.quantity)
    })
    return Array.from(portMap.entries()).map(([port, quantity]) => ({ port, quantity }))
  }

  const getStatusText = (status: VoyageStatus) => {
    const map: Record<VoyageStatus, string> = {
      active: '进行中',
      completed: '已完成',
      draft: '草稿'
    }
    return map[status]
  }

  const getVoyageDays = (voyage: Voyage) => {
    const start = dayjs(voyage.departureDate)
    const end = voyage.arrivalDate ? dayjs(voyage.arrivalDate) : dayjs()
    return end.diff(start, 'day') + 1
  }

  const handleVoyageClick = (voyage: Voyage) => {
    Taro.navigateTo({
      url: `/pages/voyage-detail/index?id=${voyage.id}`
    })
  }

  const handleSetCurrentVoyage = (voyage: Voyage, e: any) => {
    e.stopPropagation()
    Taro.showModal({
      title: '切换航次',
      content: `是否切换到当前航次「${voyage.fromPort} → ${voyage.toPort}」？`,
      success: (res) => {
        if (res.confirm) {
          setCurrentVoyage(voyage)
          Taro.switchTab({ url: '/pages/voyage/index' })
        }
      }
    })
  }

  const filters = [
    { key: 'all' as const, label: '全部' },
    { key: 'active' as const, label: '进行中' },
    { key: 'completed' as const, label: '已完成' },
    { key: 'draft' as const, label: '草稿' }
  ]

  return (
    <ScrollView className={styles.page} scrollY>
      <View className={styles.header}>
        <Text className={styles.title}>历史航次</Text>
        <Text className={styles.subtitle}>查看和管理所有航次记录</Text>
      </View>

      <View className={styles.filterSection}>
        <View className={styles.searchBar}>
          <Text className={styles.searchIcon}>🔍</Text>
          <Input
            className={styles.searchInput}
            placeholder='搜索船名、港口...'
            value={searchText}
            onInput={(e) => setSearchText(e.detail.value)}
          />
        </View>
        <View className={styles.filterTabs}>
          {filters.map(f => (
            <View
              key={f.key}
              className={`${styles.filterTab} ${activeFilter === f.key ? styles.active : ''}`}
              onClick={() => setActiveFilter(f.key)}
            >
              <Text>{f.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View className={styles.statSummary}>
        <View className={styles.statItem}>
          <Text className={styles.statValue}>{stats.totalVoyages}</Text>
          <Text className={styles.statLabel}>已完成航次</Text>
        </View>
        <View className={styles.statItem}>
          <Text className={styles.statValue}>{stats.totalDistance}</Text>
          <Text className={styles.statLabel}>总航程(海里)</Text>
        </View>
        <View className={styles.statItem}>
          <Text className={styles.statValue}>{stats.totalFuel}</Text>
          <Text className={styles.statLabel}>总油耗(吨)</Text>
        </View>
      </View>

      <View className={styles.voyageList}>
        {filteredVoyages.length > 0 ? (
          filteredVoyages.map(voyage => {
            const portSummary = getPortSummary(voyage)
            return (
              <View
                key={voyage.id}
                className={`${styles.voyageCard} ${styles[voyage.status]}`}
                onClick={() => handleVoyageClick(voyage)}
              >
                <View className={styles.voyageHeader}>
                  <View className={styles.voyageRoute}>
                    <View className={styles.routeText}>
                      <Text className={styles.portName}>{voyage.fromPort}</Text>
                      <Text className={styles.arrow}>→</Text>
                      <Text className={styles.portName}>{voyage.toPort}</Text>
                    </View>
                    <Text className={styles.vesselInfo}>
                      {voyage.vesselName} · {voyage.vesselType} · {getVoyageDays(voyage)}天
                    </Text>
                  </View>
                  <View className={`${styles.statusBadge} ${styles[voyage.status]}`}>
                    <Text>{getStatusText(voyage.status)}</Text>
                  </View>
                </View>

                <View className={styles.voyageStats}>
                  <View className={styles.stat}>
                    <Text className={styles.value}>{voyage.totalDistance || '-'}</Text>
                    <Text className={styles.label}>航程(海里)</Text>
                  </View>
                  <View className={styles.stat}>
                    <Text className={styles.value}>{voyage.totalFuelConsumed?.toFixed(1) || '-'}</Text>
                    <Text className={styles.label}>油耗(吨)</Text>
                  </View>
                  <View className={styles.stat}>
                    <Text className={styles.value}>{voyage.avgDailyConsumption?.toFixed(2) || '-'}</Text>
                    <Text className={styles.label}>日均(吨/天)</Text>
                  </View>
                </View>

                {portSummary.length > 0 && (
                  <View className={styles.portSummary}>
                    <View className={styles.summaryTitle}>
                      <Text>⛽</Text>
                      <Text>港口补给汇总</Text>
                    </View>
                    <View className={styles.portList}>
                      {portSummary.map(({ port, quantity }) => (
                        <View key={port} className={styles.portItem}>
                          <Text className={styles.portName}>{port}</Text>
                          <Text className={styles.quantity}>+{quantity.toFixed(0)}吨</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                <View className={styles.voyageFooter}>
                  <Text className={styles.dateInfo}>
                    {dayjs(voyage.departureDate).format('YYYY-MM-DD')}
                    {voyage.arrivalDate && ` ~ ${dayjs(voyage.arrivalDate).format('YYYY-MM-DD')}`}
                  </Text>
                  <View className={styles.viewBtn}>
                    <Text>查看详情</Text>
                    <Text>›</Text>
                  </View>
                </View>
              </View>
            )
          })
        ) : (
          <View className={styles.emptyState}>
            <Text className={styles.icon}>📋</Text>
            <Text className={styles.title}>暂无航次记录</Text>
            <Text className={styles.subtitle}>创建新航次开始记录</Text>
          </View>
        )}

        {filteredVoyages.length > 0 && (
          <View className={styles.loadMore}>
            <Text>— 已加载全部 {filteredVoyages.length} 条记录 —</Text>
          </View>
        )}
      </View>
    </ScrollView>
  )
}

export default HistoryPage
