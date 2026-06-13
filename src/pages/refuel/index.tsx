import React, { useState, useCallback, useMemo, useEffect } from 'react'
import { View, Text, ScrollView, Button } from '@tarojs/components'
import Taro, { usePullDownRefresh, useDidShow } from '@tarojs/taro'
import styles from './index.module.scss'
import { useVoyageStore } from '@/store/useVoyageStore'
import RefuelItem from '@/components/RefuelItem'
import FormField from '@/components/FormField'
import { mockRefuelRecords, portOptions, fuelTypeOptions } from '@/data/mockData'
import type { RefuelRecord } from '@/types'
import { formatFuelAmount } from '@/utils/fuelCalculator'
import dayjs from 'dayjs'

interface PortSummary {
  port: string
  totalQuantity: number
  totalAmount: number
  count: number
}

const RefuelPage: React.FC = () => {
  const { currentVoyage, addRefuelRecord, syncData, loadData, isOffline, offlineQueue } = useVoyageStore()
  const [, setIsRefreshing] = useState(false)
  const [addModalVisible, setAddModalVisible] = useState(false)
  const [formData, setFormData] = useState({
    date: dayjs().format('YYYY-MM-DD'),
    port: '',
    tankId: '',
    quantity: '',
    unitPrice: '',
    fuelType: '',
    supplier: '',
    remarks: ''
  })
  const [receiptImages, setReceiptImages] = useState<string[]>([])

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
    } catch (error) {
      console.error('[RefuelPage] 刷新失败', error)
    } finally {
      setIsRefreshing(false)
      Taro.stopPullDownRefresh()
    }
  }, [syncData])

  const records = currentVoyage?.refuelRecords.length ? currentVoyage.refuelRecords : mockRefuelRecords

  const portSummaries = useMemo<PortSummary[]>(() => {
    const portMap = new Map<string, PortSummary>()
    records.forEach(record => {
      const existing = portMap.get(record.port) || {
        port: record.port,
        totalQuantity: 0,
        totalAmount: 0,
        count: 0
      }
      existing.totalQuantity += record.quantity
      existing.totalAmount += record.totalAmount
      existing.count += 1
      portMap.set(record.port, existing)
    })
    return Array.from(portMap.values())
  }, [records])

  const totalQuantity = records.reduce((sum, r) => sum + r.quantity, 0)
  const totalAmount = records.reduce((sum, r) => sum + r.totalAmount, 0)

  const tanks = currentVoyage?.tanks || []
  const tankOptions = tanks.length > 0 
    ? tanks.map(t => ({ label: `${t.name} (${t.fuelType})`, value: t.id }))
    : []

  useEffect(() => {
    if (tanks.length > 0 && formData.tankId === '') {
      setFormData(prev => ({ ...prev, tankId: tanks[0].id, fuelType: tanks[0].fuelType }))
    }
  }, [tanks, formData.tankId])

  const selectedTank = useMemo(() => {
    return tanks.find(t => t.id === formData.tankId)
  }, [tanks, formData.tankId])

  const handleAddRefuel = () => {
    if (!currentVoyage) {
      Taro.showToast({
        title: '请先创建航次',
        icon: 'none'
      })
      return
    }
    if (tanks.length === 0) {
      Taro.showToast({
        title: '请先配置油舱',
        icon: 'none'
      })
      return
    }
    setFormData({
      date: dayjs().format('YYYY-MM-DD'),
      port: '',
      tankId: tanks[0]?.id || '',
      quantity: '',
      unitPrice: '',
      fuelType: tanks[0]?.fuelType || '',
      supplier: '',
      remarks: ''
    })
    setReceiptImages([])
    setAddModalVisible(true)
  }

  const handleChooseImage = () => {
    Taro.chooseImage({
      count: 3,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        setReceiptImages([...receiptImages, ...res.tempFilePaths].slice(0, 3))
      }
    })
  }

  const handleRemoveImage = (index: number) => {
    setReceiptImages(receiptImages.filter((_, i) => i !== index))
  }

  const handleFormChange = (key: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [key]: value }))
  }

  const handleSubmit = () => {
    const { date, port, tankId, quantity, unitPrice, fuelType, supplier } = formData

    if (!date || !port || !tankId || !quantity || !unitPrice || !fuelType || !supplier) {
      Taro.showToast({
        title: '请填写完整信息',
        icon: 'none'
      })
      return
    }

    const qty = Number(quantity)
    const price = Number(unitPrice)

    if (selectedTank && qty + selectedTank.currentLevel > selectedTank.capacity) {
      Taro.showToast({
        title: '加油量超过油舱容量',
        icon: 'none'
      })
      return
    }

    const newRecord: RefuelRecord = {
      id: `refuel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      voyageId: currentVoyage?.id || '',
      date,
      port,
      tankId,
      tankName: selectedTank?.name || '',
      quantity: qty,
      unitPrice: price,
      totalAmount: qty * price,
      fuelType,
      supplier,
      receiptImage: receiptImages[0],
      remarks: formData.remarks,
      operator: currentVoyage?.chiefEngineer || '轮机员',
      createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      isSynced: !isOffline,
      syncedAt: isOffline ? undefined : dayjs().format('YYYY-MM-DD HH:mm:ss')
    }

    addRefuelRecord(newRecord)

    Taro.showToast({
      title: isOffline ? '已暂存本地' : '登记成功',
      icon: 'success'
    })

    setAddModalVisible(false)
    console.log('[RefuelPage] 加油记录已添加', newRecord)
  }

  const handleRecordClick = (record: RefuelRecord) => {
    Taro.navigateTo({
      url: `/pages/refuel-detail/index?id=${record.id}`
    })
  }

  return (
    <ScrollView className={styles.page} scrollY>
      {/* 总览区域 */}
      <View className={styles.summarySection}>
        <Text className={styles.summaryTitle}>加油总览</Text>
        <View className={styles.summaryStats}>
          <View className={styles.summaryItem}>
            <Text className={styles.summaryValue}>{records.length}</Text>
            <Text className={styles.summaryLabel}>加油次数</Text>
          </View>
          <View className={styles.summaryDivider} />
          <View className={styles.summaryItem}>
            <Text className={styles.summaryValue}>{formatFuelAmount(totalQuantity)}</Text>
            <Text className={styles.summaryLabel}>总加油量(吨)</Text>
          </View>
          <View className={styles.summaryDivider} />
          <View className={styles.summaryItem}>
            <Text className={styles.summaryValue}>¥{(totalAmount / 10000).toFixed(0)}万</Text>
            <Text className={styles.summaryLabel}>总金额</Text>
          </View>
        </View>
      </View>

      {/* 港口汇总 */}
      {portSummaries.length > 0 && (
        <View className={styles.filterSection}>
          <View className={styles.sectionHeader}>
            <Text className={styles.sectionTitle}>按港口汇总</Text>
          </View>
          <View className={styles.portSummary}>
            {portSummaries.map(summary => (
              <View key={summary.port} className={styles.portItem}>
                <View style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text className={styles.portName}>{summary.port}</Text>
                  <View className={styles.portStats}>
                    <Text>{summary.count}次</Text>
                    <Text>{formatFuelAmount(summary.totalQuantity)}吨</Text>
                    <Text>¥{(summary.totalAmount).toLocaleString()}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* 加油记录列表 */}
      <View className={styles.refuelList}>
        <View className={styles.sectionHeader}>
          <Text className={styles.sectionTitle}>
            加油记录 ({records.length})
          </Text>
        </View>

        {records.length > 0 ? (
          <View className={styles.recordList}>
            {records.map(record => (
              <RefuelItem
                key={record.id}
                record={record}
                onClick={() => handleRecordClick(record)}
              />
            ))}
          </View>
        ) : (
          <View className={styles.emptyState}>
            <Text className={styles.emptyIcon}>⛽</Text>
            <Text className={styles.emptyText}>暂无加油记录</Text>
            <Text className={styles.emptyDesc}>点击右下角按钮添加加油记录</Text>
          </View>
        )}
      </View>

      {/* 悬浮添加按钮 */}
      <View className={styles.fabButton} onClick={handleAddRefuel}>
        <Text className={styles.fabIcon}>+</Text>
      </View>

      {/* 添加弹窗 */}
      {addModalVisible && (
        <View className={styles.addModal} onClick={() => setAddModalVisible(false)}>
          <View className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <View className={styles.modalHeader}>
              <Text className={styles.modalTitle}>登记加油单</Text>
              <Text className={styles.modalClose} onClick={() => setAddModalVisible(false)}>×</Text>
            </View>

            <FormField
              key='date'
              label='加油日期'
              type='date'
              required
              value={formData.date}
              onChange={v => handleFormChange('date', v)}
            />

            <FormField
              key='port'
              label='加油港口'
              type='select'
              required
              options={portOptions}
              placeholder='请选择港口'
              value={formData.port}
              onChange={v => handleFormChange('port', v)}
            />

            <FormField
              key='tankId'
              label='加油舱'
              type='select'
              required
              options={tankOptions}
              placeholder='请选择油舱'
              value={formData.tankId}
              onChange={v => handleFormChange('tankId', v)}
            />

            <FormField
              key='fuelType'
              label='油品类型'
              type='select'
              required
              options={fuelTypeOptions}
              placeholder='请选择油品'
              value={formData.fuelType}
              onChange={v => handleFormChange('fuelType', v)}
            />

            <FormField
              key='quantity'
              label='加油数量'
              type='number'
              required
              placeholder='请输入加油量'
              unit='吨'
              value={formData.quantity}
              onChange={v => handleFormChange('quantity', v)}
            />

            <FormField
              key='unitPrice'
              label='单价'
              type='number'
              required
              placeholder='请输入单价'
              unit='元/吨'
              value={formData.unitPrice}
              onChange={v => handleFormChange('unitPrice', v)}
            />

            <FormField
              key='supplier'
              label='供应商'
              type='text'
              required
              placeholder='请输入供应商名称'
              value={formData.supplier}
              onChange={v => handleFormChange('supplier', v)}
            />

            <FormField
              key='remarks'
              label='备注'
              type='textarea'
              placeholder='请输入备注信息（选填）'
              value={formData.remarks}
              onChange={v => handleFormChange('remarks', v)}
            />

            {/* 拍照上传 */}
            <View className={styles.photoSection}>
              <Text className={styles.photoLabel}>凭证照片（最多3张）</Text>
              <ScrollView className={styles.photoGrid} scrollX enableFlex>
                {receiptImages.map((_, index) => (
                  <View key={index} className={styles.photoItem}>
                    <View className={styles.photoImage}>
                      <Text>📄</Text>
                    </View>
                    <View
                      className={styles.photoRemove}
                      onClick={() => handleRemoveImage(index)}
                    >
                      <Text>×</Text>
                    </View>
                  </View>
                ))}
                {receiptImages.length < 3 && (
                  <View className={styles.photoAdd} onClick={handleChooseImage}>
                    <Text className={styles.photoIcon}>📷</Text>
                    <Text>拍照</Text>
                  </View>
                )}
              </ScrollView>
            </View>

            {formData.quantity && formData.unitPrice && (
              <View style={{
                padding: '24rpx',
                background: '#F0F2F5',
                borderRadius: '12rpx',
                marginBottom: '24rpx'
              }}>
                <Text style={{ fontSize: '28rpx', color: '#546E7A' }}>
                  预计金额: ¥{(Number(formData.quantity) * Number(formData.unitPrice)).toLocaleString()}
                </Text>
              </View>
            )}

            <Button
              className={styles.confirmBtn}
              onClick={handleSubmit}
              disabled={!formData.date || !formData.port || !formData.tankId || !formData.quantity || !formData.unitPrice || !formData.fuelType || !formData.supplier}
            >
              确认登记
            </Button>
          </View>
        </View>
      )}
    </ScrollView>
  )
}

export default RefuelPage
