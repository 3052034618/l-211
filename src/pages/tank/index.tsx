import React, { useState, useCallback } from 'react'
import { View, Text, ScrollView, Button } from '@tarojs/components'
import Taro, { usePullDownRefresh } from '@tarojs/taro'
import classnames from 'classnames'
import styles from './index.module.scss'
import { useVoyageStore } from '@/store/useVoyageStore'
import TankCard from '@/components/TankCard'
import FormField from '@/components/FormField'
import { mockTanks } from '@/data/mockData'
import type { Tank } from '@/types'
import {
  calculateTankPercentage,
  checkTankLevelAnomaly,
  generateAnomalyRecord,
  formatFuelAmount
} from '@/utils/fuelCalculator'
import dayjs from 'dayjs'

type FuelFilter = 'all' | '重油' | '柴油'

const TankPage: React.FC = () => {
  const { currentVoyage, addTankRecord, addAnomalyRecord, syncData } = useVoyageStore()
  const [filter, setFilter] = useState<FuelFilter>('all')
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [editingTank, setEditingTank] = useState<Tank | null>(null)
  const [newLevel, setNewLevel] = useState<string | number>('')
  const [remark, setRemark] = useState<string | number>('')
  const [, setIsRefreshing] = useState(false)

  usePullDownRefresh(() => {
    handleRefresh()
  })

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await syncData()
    } catch (error) {
      console.error('[TankPage] 刷新失败', error)
    } finally {
      setIsRefreshing(false)
      Taro.stopPullDownRefresh()
    }
  }, [syncData])

  const tanks = currentVoyage?.tanks.length ? currentVoyage.tanks : mockTanks

  const filteredTanks = filter === 'all'
    ? tanks
    : tanks.filter(t => t.fuelType === filter)

  const totalCapacity = tanks.reduce((sum, t) => sum + t.capacity, 0)
  const totalCurrent = tanks.reduce((sum, t) => sum + t.currentLevel, 0)
  const totalPercentage = totalCapacity > 0 ? (totalCurrent / totalCapacity) * 100 : 0

  const handleEditTank = (tank: Tank) => {
    setEditingTank(tank)
    setNewLevel(String(tank.currentLevel))
    setRemark('')
    setEditModalVisible(true)
  }

  const handleBatchEdit = () => {
    Taro.showToast({
      title: '批量录入功能开发中',
      icon: 'none'
    })
  }

  const handleSaveLevel = () => {
    if (!editingTank || !newLevel) return

    const level = Number(newLevel)
    if (isNaN(level) || level < 0 || level > editingTank.maxLevel) {
      Taro.showToast({
        title: `请输入0-${editingTank.maxLevel}之间的数值`,
        icon: 'none'
      })
      return
    }

    const anomalyCheck = checkTankLevelAnomaly(level, editingTank.currentLevel, editingTank.capacity)
    
    if (anomalyCheck.isAnomaly) {
      const anomaly = generateAnomalyRecord(
        currentVoyage?.id || '',
        'tank_level',
        editingTank.currentLevel,
        level,
        anomalyCheck.severity,
        anomalyCheck.deviation
      )
      addAnomalyRecord(anomaly)
      
      Taro.showModal({
        title: '存量异常提示',
        content: `${editingTank.name}存量变化${anomalyCheck.deviation}%，${
          anomalyCheck.severity === 'high' ? '严重' : anomalyCheck.severity === 'medium' ? '中度' : '轻微'
        }异常，请确认。`,
        confirmText: '确认记录',
        cancelText: '取消'
      }).then(res => {
        if (res.confirm) {
          doSaveLevel(level)
        }
      })
    } else {
      doSaveLevel(level)
    }
  }

  const doSaveLevel = (level: number) => {
    if (!editingTank) return

    const updatedTank: Tank = {
      ...editingTank,
      currentLevel: level,
      lastUpdate: dayjs().format('YYYY-MM-DD HH:mm:ss')
    }

    addTankRecord(updatedTank)
    
    Taro.showToast({
      title: '录入成功',
      icon: 'success'
    })
    
    setEditModalVisible(false)
    setEditingTank(null)
    console.log('[TankPage] 油舱存量已更新', editingTank.name, level)
  }

  const closeModal = () => {
    setEditModalVisible(false)
    setEditingTank(null)
  }

  return (
    <ScrollView className={styles.page} scrollY>
      {/* 总览区域 */}
      <View className={styles.summarySection}>
        <Text className={styles.summaryTitle}>油舱总览</Text>
        <View className={styles.summaryStats}>
          <View className={styles.summaryItem}>
            <Text className={styles.summaryValue}>{tanks.length}</Text>
            <Text className={styles.summaryLabel}>油舱数</Text>
          </View>
          <View className={styles.summaryDivider} />
          <View className={styles.summaryItem}>
            <Text className={styles.summaryValue}>{formatFuelAmount(totalCurrent)}</Text>
            <Text className={styles.summaryLabel}>总存量(吨)</Text>
          </View>
          <View className={styles.summaryDivider} />
          <View className={styles.summaryItem}>
            <Text className={styles.summaryValue}>{totalPercentage.toFixed(1)}%</Text>
            <Text className={styles.summaryLabel}>装载率</Text>
          </View>
        </View>
      </View>

      {/* 筛选标签 */}
      <View className={styles.filterSection}>
        <View className={styles.filterTabs}>
          {(['all', '重油', '柴油'] as FuelFilter[]).map(f => (
            <View
              key={f}
              className={classnames(styles.filterTab, filter === f && styles.active)}
              onClick={() => setFilter(f)}
            >
              <Text>{f === 'all' ? '全部' : f}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* 油舱列表 */}
      <View className={styles.tanksSection}>
        <View className={styles.sectionHeader}>
          <Text className={styles.sectionTitle}>
            油舱列表 ({filteredTanks.length})
          </Text>
          <View className={styles.batchBtn} onClick={handleBatchEdit}>
            <Text>批量录入</Text>
          </View>
        </View>

        {filteredTanks.length > 0 ? (
          <View className={styles.tankList}>
            {filteredTanks.map(tank => (
              <TankCard
                key={tank.id}
                tank={tank}
                onEdit={() => handleEditTank(tank)}
              />
            ))}
          </View>
        ) : (
          <View className={styles.emptyState}>
            <Text className={styles.emptyIcon}>🛢️</Text>
            <Text className={styles.emptyText}>暂无油舱数据</Text>
            <Text className={styles.emptyDesc}>请先创建航次并设置油舱信息</Text>
          </View>
        )}
      </View>

      {/* 编辑弹窗 */}
      {editModalVisible && editingTank && (
        <View className={styles.editModal} onClick={closeModal}>
          <View className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <View className={styles.modalHeader}>
              <Text className={styles.modalTitle}>录入油舱存量</Text>
              <Text className={styles.modalClose} onClick={closeModal}>×</Text>
            </View>

            <View className={styles.tankInfoPreview}>
              <View className={styles.tankInfoRow}>
                <Text className={styles.tankInfoLabel}>油舱名称</Text>
                <Text className={styles.tankInfoValue}>{editingTank.name}</Text>
              </View>
              <View className={styles.tankInfoRow}>
                <Text className={styles.tankInfoLabel}>油品类型</Text>
                <Text className={styles.tankInfoValue}>{editingTank.fuelType}</Text>
              </View>
              <View className={styles.tankInfoRow}>
                <Text className={styles.tankInfoLabel}>最大容量</Text>
                <Text className={styles.tankInfoValue}>{editingTank.maxLevel} 吨</Text>
              </View>
              <View className={styles.tankInfoRow}>
                <Text className={styles.tankInfoLabel}>当前存量</Text>
                <Text className={styles.tankInfoValue}>{formatFuelAmount(editingTank.currentLevel)} 吨</Text>
              </View>
              <View className={styles.tankInfoRow}>
                <Text className={styles.tankInfoLabel}>装载率</Text>
                <Text className={styles.tankInfoValue}>
                  {calculateTankPercentage(editingTank.currentLevel, editingTank.maxLevel).toFixed(1)}%
                </Text>
              </View>
            </View>

            <FormField
              key='newLevel'
              label='新存量'
              type='number'
              required
              placeholder='请输入新的存量数值'
              unit='吨'
              value={newLevel}
              onChange={setNewLevel}
            />

            <FormField
              key='remark'
              label='备注'
              type='textarea'
              placeholder='请输入备注信息（选填）'
              value={remark}
              onChange={setRemark}
            />

            <Button
              className={styles.confirmBtn}
              onClick={handleSaveLevel}
              disabled={!newLevel}
            >
              确认录入
            </Button>
          </View>
        </View>
      )}
    </ScrollView>
  )
}

export default TankPage
