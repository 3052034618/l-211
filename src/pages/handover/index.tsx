import React, { useState, useMemo } from 'react'
import { View, Text, ScrollView, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import classnames from 'classnames'
import styles from './index.module.scss'
import { useVoyageStore } from '@/store/useVoyageStore'
import AnomalyBadge from '@/components/AnomalyBadge'
import { mockCurrentVoyage, mockTanks } from '@/data/mockData'
import { formatFuelAmount, calculateTankPercentage } from '@/utils/fuelCalculator'
import dayjs from 'dayjs'

const HandoverPage: React.FC = () => {
  const { currentVoyage, generateHandoverReport, confirmHandover, user, exportDailyReport, exportHandover, loadData } = useVoyageStore()
  const [reportGenerated, setReportGenerated] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)

  useDidShow(() => {
    loadData()
  })


  const voyage = currentVoyage || mockCurrentVoyage
  const tanks = voyage?.tanks.length ? voyage.tanks : mockTanks
  const anomalies = voyage?.anomalies || []

  const unresolvedAnomalies = anomalies.filter(a => !a.isResolved)

  const stats = useMemo(() => {
    const totalRefueled = voyage?.refuelRecords.reduce((sum, r) => sum + r.quantity, 0) || 0
    const totalConsumed = voyage?.dailyConsumptions.reduce((sum, c) => sum + c.consumed, 0) || 0
    const avgDaily = voyage?.dailyConsumptions.length > 0
      ? totalConsumed / voyage.dailyConsumptions.length
      : 0

    return { totalRefueled, totalConsumed, avgDaily }
  }, [voyage])

  const handleGenerateReport = () => {
    if (unresolvedAnomalies.length > 0) {
      Taro.showModal({
        title: '存在未处理异常',
        content: `当前有${unresolvedAnomalies.length}条异常记录未处理，是否继续生成交接单？`,
        confirmText: '继续生成',
        cancelText: '返回处理'
      }).then(res => {
        if (res.confirm) {
          doGenerateReport()
        }
      })
    } else {
      doGenerateReport()
    }
  }

  const doGenerateReport = () => {
    const report = generateHandoverReport()
    if (report) {
      setReportGenerated(true)
      Taro.showToast({
        title: '交接单已生成',
        icon: 'success'
      })
      console.log('[HandoverPage] 交接单已生成', report)
    }
  }

  const handlePreview = () => {
    if (!reportGenerated && !voyage?.handoverReport) {
      Taro.showToast({
        title: '请先生成交接单',
        icon: 'none'
      })
      return
    }
    Taro.navigateTo({
      url: '/pages/handover-preview/index'
    })
  }

  const handleConfirm = () => {
    if (!user) {
      Taro.showToast({
        title: '请先登录',
        icon: 'none'
      })
      return
    }

    Taro.showModal({
      title: '确认交接',
      content: '确认后航次将标记为完成，数据将同步至管理端。请确认所有数据无误。',
      confirmText: '确认交接',
      cancelText: '取消'
    }).then(res => {
      if (res.confirm) {
        confirmHandover(user.name)
        Taro.showToast({
          title: '交接已确认',
          icon: 'success'
        })
        console.log('[HandoverPage] 交接已确认')
      }
    })
  }

  const handleExportDaily = async () => {
    if (!voyage) return
    setExportLoading(true)
    try {
      const today = dayjs().format('YYYY-MM-DD')
      const result = await exportDailyReport(voyage.id, today)
      if (result.success) {
        Taro.showModal({
          title: '导出成功',
          content: `文件「${result.fileName}」已保存，可在文件管理器中查看`,
          showCancel: false,
          confirmText: '知道了'
        })
      } else {
        Taro.showToast({
          title: result.message || '导出失败',
          icon: 'error'
        })
      }
    } catch (error) {
      Taro.showToast({
        title: '导出失败',
        icon: 'error'
      })
    } finally {
      setExportLoading(false)
    }
  }

  const handleExportHandover = async () => {
    if (!voyage) return
    setExportLoading(true)
    try {
      const result = await exportHandover(voyage.id)
      if (result.success) {
        Taro.showModal({
          title: '导出成功',
          content: `交接单「${result.fileName}」已保存，可分享或存档`,
          showCancel: false,
          confirmText: '知道了'
        })
      } else {
        Taro.showToast({
          title: result.message || '导出失败',
          icon: 'error'
        })
      }
    } catch (error) {
      Taro.showToast({
        title: '导出失败',
        icon: 'error'
      })
    } finally {
      setExportLoading(false)
    }
  }

  const handleExportMenu = () => {
    Taro.showActionSheet({
      itemList: ['导出燃油日报', '导出交接单'],
      success: async (res) => {
        if (res.tapIndex === 0) {
          await handleExportDaily()
        } else if (res.tapIndex === 1) {
          if (!reportGenerated && !voyage?.handoverReport) {
            Taro.showToast({
              title: '请先生成交接单',
              icon: 'none'
            })
            return
          }
          await handleExportHandover()
        }
      }
    })
  }

  const handoverReport = voyage?.handoverReport

  return (
    <ScrollView className={styles.page} scrollY>
      {/* 总览区域 */}
      <View className={styles.summarySection}>
        <Text className={styles.summaryTitle}>交接总览</Text>
        <View className={styles.summaryStats}>
          <View className={styles.summaryItem}>
            <Text className={styles.summaryValue}>{formatFuelAmount(stats.totalConsumed)}</Text>
            <Text className={styles.summaryLabel}>总油耗(吨)</Text>
          </View>
          <View className={styles.summaryDivider} />
          <View className={styles.summaryItem}>
            <Text className={styles.summaryValue}>{formatFuelAmount(stats.totalRefueled)}</Text>
            <Text className={styles.summaryLabel}>总补给(吨)</Text>
          </View>
          <View className={styles.summaryDivider} />
          <View className={styles.summaryItem}>
            <Text className={styles.summaryValue}>{stats.avgDaily.toFixed(2)}</Text>
            <Text className={styles.summaryLabel}>日均(吨/天)</Text>
          </View>
        </View>
      </View>

      {/* 航次信息 */}
      <View className={styles.section}>
        <View className={styles.sectionHeader}>
          <Text className={styles.sectionTitle}>航次信息</Text>
        </View>
        <View className={styles.voyageInfo}>
          <View className={styles.infoRow}>
            <Text className={styles.infoLabel}>船名</Text>
            <Text className={styles.infoValue}>{voyage?.vesselName}</Text>
          </View>
          <View className={styles.infoRow}>
            <Text className={styles.infoLabel}>船型</Text>
            <Text className={styles.infoValue}>{voyage?.vesselType}</Text>
          </View>
          <View className={styles.infoRow}>
            <Text className={styles.infoLabel}>航线</Text>
            <Text className={styles.infoValue}>{voyage?.fromPort} → {voyage?.toPort}</Text>
          </View>
          <View className={styles.infoRow}>
            <Text className={styles.infoLabel}>出发日期</Text>
            <Text className={styles.infoValue}>{dayjs(voyage?.departureDate).format('YYYY-MM-DD')}</Text>
          </View>
          <View className={styles.infoRow}>
            <Text className={styles.infoLabel}>船长</Text>
            <Text className={styles.infoValue}>{voyage?.captain}</Text>
          </View>
          <View className={styles.infoRow}>
            <Text className={styles.infoLabel}>轮机长</Text>
            <Text className={styles.infoValue}>{voyage?.chiefEngineer}</Text>
          </View>
        </View>
      </View>

      {/* 油舱存量 */}
      <View className={styles.section}>
        <View className={styles.sectionHeader}>
          <Text className={styles.sectionTitle}>油舱存量</Text>
        </View>
        <View className={styles.tankLevels}>
          {tanks.map(tank => {
            const percentage = calculateTankPercentage(tank.currentLevel, tank.maxLevel)
            const levelClass = percentage > 70 ? 'normal' : percentage > 30 ? 'warning' : 'danger'

            return (
              <View key={tank.id} className={styles.tankRow}>
                <Text className={styles.tankName}>{tank.name}</Text>
                <View className={styles.tankLevel}>
                  <View className={styles.levelBar}>
                    <View
                      className={classnames(styles.levelFill, styles[levelClass])}
                      style={{ width: `${percentage}%` }}
                    />
                  </View>
                  <Text className={styles.levelText}>
                    {formatFuelAmount(tank.currentLevel)}吨
                  </Text>
                </View>
              </View>
            )
          })}
        </View>
      </View>

      {/* 异常记录 */}
      {anomalies.length > 0 && (
        <View className={styles.section}>
          <View className={styles.sectionHeader}>
            <Text className={styles.sectionTitle}>
              异常记录 ({anomalies.length})
            </Text>
            {unresolvedAnomalies.length > 0 && (
              <Text
                className={styles.sectionAction}
                onClick={() => Taro.navigateTo({ url: '/pages/anomaly-detail/index' })}
              >
                {unresolvedAnomalies.length}条待处理
              </Text>
            )}
          </View>
          <View className={styles.anomalyList}>
            {anomalies.slice(0, 3).map(anomaly => (
              <View
                key={anomaly.id}
                className={classnames(
                  styles.anomalyItem,
                  anomaly.isResolved && styles.resolved,
                  !anomaly.isResolved && anomaly.severity
                )}
                onClick={() => Taro.navigateTo({
                  url: `/pages/anomaly-detail/index?id=${anomaly.id}`
                })}
              >
                <View className={styles.anomalyHeader}>
                  <Text className={styles.anomalyType}>{anomaly.description}</Text>
                  <AnomalyBadge
                    severity={anomaly.severity}
                    isResolved={anomaly.isResolved}
                  />
                </View>
                <Text className={styles.anomalyDesc}>
                  期望值 {anomaly.expectedValue}，实际值 {anomaly.actualValue}，偏差 {anomaly.deviation}%
                </Text>
                <View className={styles.anomalyFooter}>
                  <Text>{anomaly.date}</Text>
                  <Text>{anomaly.isResolved ? '已处理' : '待处理'}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* 交接单预览 */}
      {(reportGenerated || handoverReport) && (
        <View className={styles.section}>
          <View className={styles.sectionHeader}>
            <Text className={styles.sectionTitle}>交接单预览</Text>
            <Text className={styles.sectionAction} onClick={handlePreview}>
              查看详情
            </Text>
          </View>
          <View className={styles.reportPreview}>
            <View className={styles.reportHeader}>
              <Text className={styles.reportTitle}>燃油交接单</Text>
              <Text className={styles.reportSubtitle}>
                {voyage?.vesselName} · {voyage?.fromPort} → {voyage?.toPort}
              </Text>
            </View>

            <View className={styles.reportSection}>
              <Text className={styles.reportSectionTitle}>燃油统计</Text>
              <View className={styles.reportRow}>
                <Text className={styles.reportLabel}>总耗油量</Text>
                <Text className={styles.reportValue}>{formatFuelAmount(stats.totalConsumed)} 吨</Text>
              </View>
              <View className={styles.reportRow}>
                <Text className={styles.reportLabel}>总补给量</Text>
                <Text className={styles.reportValue}>{formatFuelAmount(stats.totalRefueled)} 吨</Text>
              </View>
              <View className={styles.reportRow}>
                <Text className={styles.reportLabel}>日均油耗</Text>
                <Text className={styles.reportValue}>{stats.avgDaily.toFixed(2)} 吨/天</Text>
              </View>
            </View>

            <View className={styles.reportSection}>
              <Text className={styles.reportSectionTitle}>油舱交接存量</Text>
              {tanks.map(tank => (
                <View key={tank.id} className={styles.reportRow}>
                  <Text className={styles.reportLabel}>{tank.name}</Text>
                  <Text className={styles.reportValue}>
                    {formatFuelAmount(tank.currentLevel)} 吨 ({tank.fuelType})
                  </Text>
                </View>
              ))}
            </View>

            <View className={styles.reportSignatures}>
              <View className={styles.signature}>
                <View className={styles.signatureLine} />
                <Text className={styles.signatureLabel}>轮机员</Text>
              </View>
              <View className={styles.signature}>
                <View className={styles.signatureLine} />
                <Text className={styles.signatureLabel}>船长</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* 底部操作栏 */}
      <View className={styles.bottomBar}>
        <Button className={styles.btnSecondary} onClick={handleExportMenu} loading={exportLoading}>
          导出
        </Button>
        {!reportGenerated && !handoverReport ? (
          <Button className={styles.btnPrimary} onClick={handleGenerateReport}>
            生成交接单
          </Button>
        ) : (
          <Button
            className={styles.btnPrimary}
            onClick={handleConfirm}
            disabled={handoverReport?.status === 'confirmed'}
          >
            {handoverReport?.status === 'confirmed' ? '已交接' : '确认交接'}
          </Button>
        )}
      </View>
    </ScrollView>
  )
}

export default HandoverPage
