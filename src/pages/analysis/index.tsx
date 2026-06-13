import React, { useState, useCallback, useMemo } from 'react'
import { View, Text, ScrollView, Button } from '@tarojs/components'
import Taro, { usePullDownRefresh } from '@tarojs/taro'
import styles from './index.module.scss'
import { useVoyageStore } from '@/store/useVoyageStore'
import FuelChart from '@/components/FuelChart'
import FormField from '@/components/FormField'
import AnomalyBadge from '@/components/AnomalyBadge'
import { weatherOptions } from '@/data/mockData'
import type { EngineRecord, DailyConsumption } from '@/types'
import {
  checkConsumptionAnomaly,
  generateAnomalyRecord,
  formatFuelAmount
} from '@/utils/fuelCalculator'
import dayjs from 'dayjs'

const AnalysisPage: React.FC = () => {
  const { currentVoyage, addEngineRecord, addDailyConsumption, addAnomalyRecord, syncData } = useVoyageStore()
  const [, setIsRefreshing] = useState(false)
  const [addModalVisible, setAddModalVisible] = useState(false)
  const [formData, setFormData] = useState({
    date: dayjs().format('YYYY-MM-DD'),
    engineHours: '24',
    rpm: '',
    power: '',
    fuelConsumption: '',
    speed: '',
    weather: '',
    windSpeed: '',
    waveHeight: '',
    remarks: ''
  })

  usePullDownRefresh(() => {
    handleRefresh()
  })

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await syncData()
    } catch (error) {
      console.error('[AnalysisPage] 刷新失败', error)
    } finally {
      setIsRefreshing(false)
      Taro.stopPullDownRefresh()
    }
  }, [syncData])

  const engineRecords = currentVoyage?.engineRecords || []
  const dailyConsumptions = currentVoyage?.dailyConsumptions || []

  const stats = useMemo(() => {
    const totalHours = engineRecords.reduce((sum, r) => sum + r.engineHours, 0)
    const totalConsumption = dailyConsumptions.reduce((sum, c) => sum + c.consumed, 0)
    const avgDaily = dailyConsumptions.length > 0 ? totalConsumption / dailyConsumptions.length : 0
    const totalDistance = dailyConsumptions.reduce((sum, c) => sum + c.distance, 0)
    
    return { totalHours, totalConsumption, avgDaily, totalDistance }
  }, [engineRecords, dailyConsumptions])

  const handleAddRecord = () => {
    setFormData({
      date: dayjs().format('YYYY-MM-DD'),
      engineHours: '24',
      rpm: '',
      power: '',
      fuelConsumption: '',
      speed: '',
      weather: '',
      windSpeed: '',
      waveHeight: '',
      remarks: ''
    })
    setAddModalVisible(true)
  }

  const handleFormChange = (key: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [key]: value }))
  }

  const handleSubmit = () => {
    const { date, engineHours, rpm, power, fuelConsumption, speed, weather } = formData

    if (!date || !engineHours || !rpm || !power || !fuelConsumption || !speed || !weather) {
      Taro.showToast({
        title: '请填写完整信息',
        icon: 'none'
      })
      return
    }

    const avgConsumption = stats.avgDaily
    const consumption = Number(fuelConsumption)
    const anomalyCheck = checkConsumptionAnomaly(consumption, avgConsumption)

    if (anomalyCheck.isAnomaly) {
      const anomaly = generateAnomalyRecord(
        currentVoyage?.id || '',
        'consumption',
        avgConsumption,
        consumption,
        anomalyCheck.severity,
        anomalyCheck.deviation
      )
      addAnomalyRecord(anomaly)

      Taro.showModal({
        title: '油耗异常提示',
        content: `当日油耗${consumption}吨/天，偏离平均值${anomalyCheck.deviation}%，${
          anomalyCheck.severity === 'high' ? '严重' : anomalyCheck.severity === 'medium' ? '中度' : '轻微'
        }异常，请确认。`,
        confirmText: '确认记录',
        cancelText: '取消'
      }).then(res => {
        if (res.confirm) {
          doSubmit()
        }
      })
    } else {
      doSubmit()
    }
  }

  const doSubmit = () => {
    const { date, engineHours, rpm, power, fuelConsumption, speed, weather, windSpeed, waveHeight, remarks } = formData

    const engineRecord: EngineRecord = {
      id: `engine_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      voyageId: currentVoyage?.id || '',
      date,
      engineHours: Number(engineHours),
      rpm: Number(rpm),
      power: Number(power),
      fuelConsumption: Number(fuelConsumption),
      speed: Number(speed),
      weather,
      windSpeed: Number(windSpeed || 0),
      waveHeight: Number(waveHeight || 0),
      remarks,
      operator: currentVoyage?.chiefEngineer || '轮机员',
      createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss')
    }

    const lastConsumption = dailyConsumptions[dailyConsumptions.length - 1]
    const totalFuelLevel = currentVoyage?.currentFuelLevel ?? currentVoyage?.tanks.reduce((sum, t) => sum + t.currentLevel, 0) ?? 0
    const startLevel = lastConsumption?.endLevel ?? totalFuelLevel
    const refueled = 0
    const endLevel = startLevel - Number(fuelConsumption) + refueled

    const dailyRecord: DailyConsumption = {
      id: `daily_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      date,
      fuelType: '重油',
      startLevel,
      endLevel,
      refueled,
      consumed: Number(fuelConsumption),
      engineHours: Number(engineHours),
      distance: Number(speed) * Number(engineHours),
      avgSpeed: Number(speed),
      weather
    }

    addEngineRecord(engineRecord)
    addDailyConsumption(dailyRecord)

    Taro.showToast({
      title: '记录成功',
      icon: 'success'
    })

    setAddModalVisible(false)
    console.log('[AnalysisPage] 主机记录已添加', engineRecord, dailyRecord)
  }

  const getConsumptionStatus = (consumption: number) => {
    const avg = stats.avgDaily
    if (avg === 0) return ''
    const deviation = (consumption - avg) / avg
    if (deviation > 0.3) return 'danger'
    if (deviation > 0.15) return 'warning'
    return 'normal'
  }

  return (
    <ScrollView className={styles.page} scrollY>
      {/* 总览区域 */}
      <View className={styles.summarySection}>
        <Text className={styles.summaryTitle}>油耗总览</Text>
        <View className={styles.summaryStats}>
          <View className={styles.summaryItem}>
            <Text className={styles.summaryValue}>{stats.totalHours}</Text>
            <Text className={styles.summaryLabel}>运行小时</Text>
          </View>
          <View className={styles.summaryDivider} />
          <View className={styles.summaryItem}>
            <Text className={styles.summaryValue}>{formatFuelAmount(stats.totalConsumption)}</Text>
            <Text className={styles.summaryLabel}>总油耗(吨)</Text>
          </View>
          <View className={styles.summaryDivider} />
          <View className={styles.summaryItem}>
            <Text className={styles.summaryValue}>{stats.avgDaily.toFixed(2)}</Text>
            <Text className={styles.summaryLabel}>日均(吨/天)</Text>
          </View>
        </View>
      </View>

      {/* 油耗趋势图 */}
      <View className={styles.chartSection}>
        <FuelChart
          data={dailyConsumptions}
          title='每日油耗趋势'
          subtitle={`近${dailyConsumptions.length}天数据`}
        />
      </View>

      {/* 主机运行记录 */}
      <View className={styles.recordsSection}>
        <View className={styles.sectionHeader}>
          <Text className={styles.sectionTitle}>
            运行记录 ({engineRecords.length})
          </Text>
          <Text
            className={styles.sectionAction}
            onClick={() => Taro.showToast({ title: '导出功能开发中', icon: 'none' })}
          >
            导出日报
          </Text>
        </View>

        {engineRecords.length > 0 ? (
          <View>
            {engineRecords.slice().reverse().map((record) => {
              const daily = dailyConsumptions.find(d => d.date === record.date)
              const status = daily ? getConsumptionStatus(daily.consumed) : ''
              const isAnomaly = status === 'danger' || status === 'warning'

              return (
                <View key={record.id} className={styles.recordItem}>
                  <View className={styles.recordHeader}>
                    <Text className={styles.recordDate}>{record.date}</Text>
                    <View style={{ display: 'flex', alignItems: 'center', gap: '16rpx' }}>
                      <View className={styles.recordWeather}>
                        <Text>{record.weather}</Text>
                      </View>
                      {isAnomaly && (
                        <AnomalyBadge
                          severity={status === 'danger' ? 'high' : 'medium'}
                        />
                      )}
                    </View>
                  </View>

                  <View className={styles.recordGrid}>
                    <View className={styles.recordCell}>
                      <Text className={styles.cellLabel}>转速</Text>
                      <Text className={styles.cellValue}>{record.rpm} RPM</Text>
                    </View>
                    <View className={styles.recordCell}>
                      <Text className={styles.cellLabel}>功率</Text>
                      <Text className={styles.cellValue}>{record.power} KW</Text>
                    </View>
                    <View className={styles.recordCell}>
                      <Text className={styles.cellLabel}>航速</Text>
                      <Text className={styles.cellValue}>{record.speed.toFixed(1)} 节</Text>
                    </View>
                    <View className={styles.recordCell}>
                      <Text className={styles.cellLabel}>运行时间</Text>
                      <Text className={styles.cellValue}>{record.engineHours} h</Text>
                    </View>
                    <View className={styles.recordCell}>
                      <Text className={styles.cellLabel}>风力</Text>
                      <Text className={styles.cellValue}>{record.windSpeed} 级</Text>
                    </View>
                    <View className={styles.recordCell}>
                      <Text className={styles.cellLabel}>浪高</Text>
                      <Text className={styles.cellValue}>{record.waveHeight.toFixed(1)} m</Text>
                    </View>
                  </View>

                  <View className={styles.recordFooter}>
                    <Text>油耗: {record.fuelConsumption.toFixed(2)} 吨</Text>
                    <Text>录入人: {record.operator}</Text>
                  </View>
                </View>
              )
            })}
          </View>
        ) : (
          <View className={styles.emptyState}>
            <Text className={styles.emptyIcon}>📊</Text>
            <Text className={styles.emptyText}>暂无运行记录</Text>
            <Text className={styles.emptyDesc}>点击右下角按钮添加记录</Text>
          </View>
        )}
      </View>

      {/* 悬浮添加按钮 */}
      <View className={styles.fabButton} onClick={handleAddRecord}>
        <Text className={styles.fabIcon}>+</Text>
      </View>

      {/* 添加弹窗 */}
      {addModalVisible && (
        <View className={styles.addModal} onClick={() => setAddModalVisible(false)}>
          <View className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <View className={styles.modalHeader}>
              <Text className={styles.modalTitle}>记录主机运行</Text>
              <Text className={styles.modalClose} onClick={() => setAddModalVisible(false)}>×</Text>
            </View>

            <FormField
              key='date'
              label='日期'
              type='date'
              required
              value={formData.date}
              onChange={v => handleFormChange('date', v)}
            />

            <View className={styles.formGrid}>
              <FormField
                key='engineHours'
                label='运行时间'
                type='number'
                required
                placeholder='运行小时'
                unit='小时'
                value={formData.engineHours}
                onChange={v => handleFormChange('engineHours', v)}
              />
              <FormField
                key='rpm'
                label='主机转速'
                type='number'
                required
                placeholder='转速'
                unit='RPM'
                value={formData.rpm}
                onChange={v => handleFormChange('rpm', v)}
              />
              <FormField
                key='power'
                label='主机功率'
                type='number'
                required
                placeholder='功率'
                unit='KW'
                value={formData.power}
                onChange={v => handleFormChange('power', v)}
              />
              <FormField
                key='fuelConsumption'
                label='今日油耗'
                type='number'
                required
                placeholder='油耗量'
                unit='吨'
                value={formData.fuelConsumption}
                onChange={v => handleFormChange('fuelConsumption', v)}
              />
              <FormField
                key='speed'
                label='平均航速'
                type='number'
                required
                placeholder='航速'
                unit='节'
                value={formData.speed}
                onChange={v => handleFormChange('speed', v)}
              />
              <FormField
                key='weather'
                label='天气'
                type='select'
                required
                options={weatherOptions}
                placeholder='请选择'
                value={formData.weather}
                onChange={v => handleFormChange('weather', v)}
              />
              <FormField
                key='windSpeed'
                label='风力'
                type='number'
                placeholder='风力等级'
                unit='级'
                value={formData.windSpeed}
                onChange={v => handleFormChange('windSpeed', v)}
              />
              <FormField
                key='waveHeight'
                label='浪高'
                type='number'
                placeholder='浪高'
                unit='米'
                value={formData.waveHeight}
                onChange={v => handleFormChange('waveHeight', v)}
              />
            </View>

            <FormField
              key='remarks'
              label='备注'
              type='textarea'
              placeholder='备注信息（选填）'
              value={formData.remarks}
              onChange={v => handleFormChange('remarks', v)}
            />

            <Button
              className={styles.confirmBtn}
              onClick={handleSubmit}
              disabled={!formData.date || !formData.engineHours || !formData.rpm || !formData.power || !formData.fuelConsumption || !formData.speed || !formData.weather}
            >
              确认记录
            </Button>
          </View>
        </View>
      )}
    </ScrollView>
  )
}

export default AnalysisPage
