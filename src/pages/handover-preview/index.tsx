import React, { useState, useMemo } from 'react'
import { View, Text, ScrollView, Button } from '@tarojs/components'
import Taro, { useRouter, useDidShow } from '@tarojs/taro'
import styles from './index.module.scss'
import { useVoyageStore } from '@/store/useVoyageStore'
import { mockUser } from '@/data/mockData'
import type { HandoverReport, Voyage } from '@/types'
import dayjs from 'dayjs'

const HandoverPreviewPage: React.FC = () => {
  const router = useRouter()
  const { currentVoyage, confirmHandover, user, setUser, generateHandoverReport, getVoyageById, loadData, exportHandover } = useVoyageStore()
  const [report, setReport] = useState<HandoverReport | null>(null)
  const [voyage, setVoyage] = useState<Voyage | null>(null)
  const [isConfirming, setIsConfirming] = useState(false)

  useDidShow(async () => {
    await loadData()
    if (!user) setUser(mockUser)

    const voyageId = router.params.id
    let targetVoyage: Voyage | null | undefined = currentVoyage
    const isHistoricalVoyage = !!voyageId
    
    if (voyageId) {
      targetVoyage = getVoyageById(voyageId)
    }
    
    setVoyage(targetVoyage || null)

    if (!targetVoyage) {
      setReport(null)
      return
    }

    if (targetVoyage.handoverReport) {
      setReport(targetVoyage.handoverReport)
    } else if (!isHistoricalVoyage) {
      const generated = generateHandoverReport()
      if (generated) {
        setReport(generated)
      } else {
        setReport(null)
      }
    } else {
      setReport(null)
    }
  })

  const getVoyageDays = () => {
    if (!report) return 0
    const start = dayjs(report.departureDate)
    const end = report.arrivalDate ? dayjs(report.arrivalDate) : dayjs()
    return end.diff(start, 'day') + 1
  }

  const getProgressColor = (level: number, capacity: number) => {
    const percentage = (level / capacity) * 100
    if (percentage < 20) return styles.danger
    if (percentage < 40) return styles.warning
    return ''
  }

  const getTotalCapacity = () => {
    if (!voyage) return 0
    return voyage.tanks.reduce((sum, t) => sum + t.capacity, 0)
  }

  const getSeverityText = (severity: string, isResolved: boolean) => {
    if (isResolved) return '已处理'
    const map: Record<string, string> = {
      low: '轻微',
      medium: '中度',
      high: '严重'
    }
    return map[severity] || '未知'
  }

  const handleExport = async () => {
    if (!report || !voyage) return
    try {
      const result = await exportHandover(voyage.id)
      if (result.success) {
        Taro.showModal({
          title: '导出成功',
          content: `交接单「${result.fileName}」已保存`,
          showCancel: false
        })
      } else {
        Taro.showToast({
          title: result.message || '导出失败',
          icon: 'none'
        })
      }
    } catch (error) {
      Taro.showToast({
        title: '导出失败',
        icon: 'error'
      })
    }
  }

  const handleConfirm = async () => {
    if (!user || !report) return

    const unresolvedCount = report.anomalies.filter(a => !a.isResolved).length
    if (unresolvedCount > 0) {
      Taro.showModal({
        title: '存在未处理异常',
        content: `当前有 ${unresolvedCount} 条异常记录未处理，是否继续确认交接？`,
        confirmText: '继续确认',
        confirmColor: '#F44336',
        success: (res) => {
          if (res.confirm) {
            doConfirm()
          }
        }
      })
      return
    }

    Taro.showModal({
      title: '确认交接',
      content: '确认后航次将标记为已完成，交接单将同步至船队管理系统。是否继续？',
      success: (res) => {
        if (res.confirm) {
          doConfirm()
        }
      }
    })
  }

  const doConfirm = async () => {
    if (!user) return
    setIsConfirming(true)
    try {
      confirmHandover(user.name)
      setReport(prev => prev ? {
        ...prev,
        confirmedBy: user.name,
        confirmedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        status: 'confirmed'
      } : null)

      Taro.showModal({
        title: '交接成功',
        content: '航次交接已完成，数据已同步。是否返回首页？',
        success: (res) => {
          if (res.confirm) {
            Taro.switchTab({ url: '/pages/voyage/index' })
          }
        }
      })
    } catch (error) {
      console.error('[HandoverPreview] 确认失败', error)
      Taro.showToast({ title: '确认失败，请重试', icon: 'none' })
    } finally {
      setIsConfirming(false)
    }
  }

  const unresolvedCount = useMemo(() => {
    return report?.anomalies.filter(a => !a.isResolved).length || 0
  }, [report])

  if (!report) {
    return (
      <View className={styles.page}>
        <View style={{ padding: 100, textAlign: 'center' }}>
          <Text className={styles.emptyIcon}>📋</Text>
          <Text className={styles.emptyText}>暂无交接单数据</Text>
          <Text className={styles.emptyDesc}>请先生成交接单</Text>
        </View>
      </View>
    )
  }

  return (
    <ScrollView className={styles.page} scrollY>
      <View className={styles.reportContainer}>
        <View className={styles.reportHeader}>
          <Text className={styles.reportTitle}>航次燃油交接单</Text>
          <Text className={styles.reportSubtitle}>{report.vesselName}</Text>
          <Text className={styles.reportId}>单据编号：{report.id}</Text>
        </View>

        <View className={styles.voyageInfo}>
          <View className={styles.route}>
            <Text className={styles.port}>{report.fromPort}</Text>
            <Text className={styles.arrow}>→</Text>
            <Text className={styles.port}>{report.toPort}</Text>
          </View>
          <Text className={styles.vesselName}>{report.vesselName} · {getVoyageDays()} 天航次</Text>
          <Text className={styles.dateRange}>
            {dayjs(report.departureDate).format('YYYY年MM月DD日')} — {dayjs(report.arrivalDate).format('YYYY年MM月DD日')}
          </Text>
        </View>

        <View className={styles.summaryStats}>
          <View className={styles.statItem}>
            <Text className={styles.statValue}>{report.totalFuelConsumed.toFixed(1)}</Text>
            <Text className={styles.statLabel}>总油耗</Text>
            <Text className={styles.statUnit}>吨</Text>
          </View>
          <View className={styles.statItem}>
            <Text className={styles.statValue}>{report.totalRefueled.toFixed(1)}</Text>
            <Text className={styles.statLabel}>总补给</Text>
            <Text className={styles.statUnit}>吨</Text>
          </View>
          <View className={styles.statItem}>
            <Text className={styles.statValue}>{report.avgDailyConsumption.toFixed(2)}</Text>
            <Text className={styles.statLabel}>日均油耗</Text>
            <Text className={styles.statUnit}>吨/天</Text>
          </View>
        </View>

        <View className={styles.section}>
          <View className={styles.sectionTitle}>
            <Text className={styles.icon}>👥</Text>
            <Text>人员信息</Text>
          </View>
          <View className={styles.infoRow}>
            <Text className={styles.label}>船长</Text>
            <Text className={styles.value}>{voyage?.captain || '--'}</Text>
          </View>
          <View className={styles.infoRow}>
            <Text className={styles.label}>轮机长</Text>
            <Text className={styles.value}>{voyage?.chiefEngineer || '--'}</Text>
          </View>
          <View className={styles.infoRow}>
            <Text className={styles.label}>制表人</Text>
            <Text className={styles.value}>{report.preparedBy}</Text>
          </View>
        </View>

        <View className={styles.section}>
          <View className={styles.sectionTitle}>
            <Text className={styles.icon}>🛢️</Text>
            <Text>油舱存量</Text>
          </View>
          <View className={styles.tankList}>
            {report.tankLevels.map((tank, index) => {
              const fullTank = voyage?.tanks.find(t => t.id === tank.tankId)
              const capacity = fullTank?.capacity || 500
              const percentage = ((tank.level / capacity) * 100).toFixed(1)
              return (
                <View key={tank.tankId} className={styles.tankItem}>
                  <View className={styles.tankHeader}>
                    <Text className={styles.tankName}>油舱 {index + 1}：{tank.tankName}</Text>
                    <Text className={styles.fuelType}>{tank.fuelType}</Text>
                  </View>
                  <View className={styles.tankBody}>
                    <View className={styles.progressBar}>
                      <View
                        className={`${styles.progressFill} ${getProgressColor(tank.level, capacity)}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </View>
                    <Text className={styles.levelText}>{tank.level.toFixed(1)} 吨</Text>
                  </View>
                  <View className={styles.tankFooter}>
                    <Text>容量：{capacity} 吨</Text>
                    <Text>装载率：{percentage}%</Text>
                  </View>
                </View>
              )
            })}
          </View>
        </View>

        <View className={styles.section}>
          <View className={styles.sectionTitle}>
            <Text className={styles.icon}>⚠️</Text>
            <Text>异常记录 {unresolvedCount > 0 && `(${unresolvedCount}条未处理)`}</Text>
          </View>
          {report.anomalies.length > 0 ? (
            <View className={styles.anomalyList}>
              {report.anomalies.map(anomaly => (
                <View key={anomaly.id} className={styles.anomalyItem}>
                  <Text className={styles.statusIcon}>{anomaly.isResolved ? '✅' : '⚠️'}</Text>
                  <View className={styles.anomalyContent}>
                    <Text className={styles.anomalyDesc}>{anomaly.description}</Text>
                    <Text className={styles.anomalyMeta}>
                      {dayjs(anomaly.date).format('YYYY-MM-DD')} · 偏差 {anomaly.deviation.toFixed(1)}%
                      {anomaly.isResolved && anomaly.resolvedBy && ` · ${anomaly.resolvedBy}处理`}
                    </Text>
                  </View>
                  <Text className={`${styles.severityBadge} ${anomaly.isResolved ? styles.resolved : styles[anomaly.severity]}`}>
                    {getSeverityText(anomaly.severity, anomaly.isResolved)}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <View className={styles.emptyAnomaly}>
              <Text>✅ 本航次无异常记录</Text>
            </View>
          )}
        </View>

        <View className={styles.section}>
          <View className={styles.sectionTitle}>
            <Text className={styles.icon}>📊</Text>
            <Text>航行统计</Text>
          </View>
          <View className={styles.infoRow}>
            <Text className={styles.label}>总航程</Text>
            <Text className={styles.value}>{voyage?.totalDistance?.toFixed(0) || '--'} 海里</Text>
          </View>
          <View className={styles.infoRow}>
            <Text className={styles.label}>航行天数</Text>
            <Text className={styles.value}>{getVoyageDays()} 天</Text>
          </View>
          <View className={styles.infoRow}>
            <Text className={styles.label}>总油舱容量</Text>
            <Text className={styles.value}>{getTotalCapacity().toFixed(0)} 吨</Text>
          </View>
          <View className={styles.infoRow}>
            <Text className={styles.label}>当前总存量</Text>
            <Text className={`${styles.value} ${styles.highlight}`}>{report.tankLevels.reduce((sum, t) => sum + t.level, 0).toFixed(1)} 吨</Text>
          </View>
        </View>

        <View className={styles.signatureSection}>
          <View className={styles.signatureItem}>
            <Text className={styles.signatureLabel}>轮机长签名</Text>
            <View className={styles.signaturePlaceholder}>
              <Text>{report.preparedBy || '未签名'}</Text>
            </View>
            <Text className={styles.signatureName}>{report.preparedBy}</Text>
            <Text className={styles.signatureDate}>{dayjs(report.arrivalDate).format('YYYY-MM-DD')}</Text>
          </View>
          <View className={styles.signatureItem}>
            <Text className={styles.signatureLabel}>船长签名</Text>
            {report.confirmedBy ? (
              <>
                <View className={styles.signaturePlaceholder}>
                  <Text>{report.confirmedBy}</Text>
                </View>
                <Text className={styles.signatureName}>{report.confirmedBy}</Text>
                <Text className={styles.signatureDate}>{report.confirmedAt ? dayjs(report.confirmedAt).format('YYYY-MM-DD') : '--'}</Text>
              </>
            ) : (
              <>
                <View className={styles.signaturePlaceholder}>
                  <Text>待确认</Text>
                </View>
                <Text className={styles.signatureName}>--</Text>
                <Text className={styles.signatureDate}>--</Text>
              </>
            )}
          </View>
        </View>

        <View className={styles.reportFooter}>
          <Text className={styles.footerText}>
            本交接单由系统自动生成，数据真实有效{'\n'}
            如有疑问请联系船队管理部门{'\n'}
            生成时间：{dayjs().format('YYYY-MM-DD HH:mm:ss')}
          </Text>
        </View>
      </View>

      <View style={{ height: 160 }} />

      {report.status !== 'confirmed' && (
        <View className={styles.bottomBar}>
          <Button className={styles.btnSecondary} onClick={handleExport} disabled={isConfirming}>
            导出
          </Button>
          <Button className={styles.btnPrimary} onClick={handleConfirm} disabled={isConfirming}>
            {isConfirming ? '确认中...' : '确认交接'}
          </Button>
        </View>
      )}
    </ScrollView>
  )
}

export default HandoverPreviewPage
