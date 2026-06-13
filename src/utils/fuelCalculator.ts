import type { DailyConsumption, EngineRecord, AnomalyRecord } from '@/types'
import dayjs from 'dayjs'

export const calculateDailyConsumption = (
  startLevel: number, endLevel: number, refueled: number): number => {
  return startLevel + refueled - endLevel
}

export const calculateAvgConsumption = (consumptions: DailyConsumption[]): number => {
  if (consumptions.length === 0) return 0
  const total = consumptions.reduce((sum, c) => sum + c.consumed, 0)
  return Number((total / consumptions.length).toFixed(2))
}

export const calculateFuelEfficiency = (
  fuelConsumed: number, distance: number): number => {
  if (distance === 0) return 0
  return Number((fuelConsumed / distance).toFixed(4))
}

export const checkConsumptionAnomaly = (
  currentConsumption: number,
  avgConsumption: number,
  threshold: number = 0.15
): { isAnomaly: boolean; deviation: number; severity: 'low' | 'medium' | 'high' } => {
  if (avgConsumption === 0) return { isAnomaly: false, deviation: 0, severity: 'low' }
  
  const deviation = Math.abs(currentConsumption - avgConsumption) / avgConsumption
  
  if (deviation > 0.3) {
    return { isAnomaly: true, deviation: Number(deviation * 100).toFixed(2) as unknown as number, severity: 'high' }
  } else if (deviation > threshold) {
    return { isAnomaly: true, deviation: Number(deviation * 100).toFixed(2) as unknown as number, severity: 'medium' }
  }
  return { isAnomaly: false, deviation: Number(deviation * 100).toFixed(2) as unknown as number, severity: 'low' }
}

export const checkTankLevelAnomaly = (
  currentLevel: number, previousLevel: number, capacity: number): { isAnomaly: boolean; deviation: number; severity: 'low' | 'medium' | 'high' } => {
  if (previousLevel === 0) return { isAnomaly: false, deviation: 0, severity: 'low' }
  
  const deviation = Math.abs(currentLevel - previousLevel) / capacity
  
  if (deviation > 0.1) {
    return { isAnomaly: true, deviation: Number(deviation * 100).toFixed(2) as unknown as number, severity: 'high' }
  } else if (deviation > 0.05) {
    return { isAnomaly: true, deviation: Number(deviation * 100).toFixed(2) as unknown as number, severity: 'medium' }
  }
  return { isAnomaly: false, deviation: Number(deviation * 100).toFixed(2) as unknown as number, severity: 'low' }
}

export const checkEngineAnomaly = (
  engineRecord: EngineRecord, avgFuelPerHour: number): { isAnomaly: boolean; deviation: number; severity: 'low' | 'medium' | 'high' } => {
  if (engineRecord.engineHours === 0) return { isAnomaly: false, deviation: 0, severity: 'low' }
  
  const currentFuelPerHour = engineRecord.fuelConsumption / engineRecord.engineHours
  return checkConsumptionAnomaly(currentFuelPerHour, avgFuelPerHour)
}

export const generateAnomalyRecord = (
  voyageId: string,
  type: AnomalyRecord['type'],
  expectedValue: number,
  actualValue: number,
  severity: 'low' | 'medium' | 'high',
  deviation: number
): AnomalyRecord => {
  const typeDescriptions: Record<AnomalyRecord['type'], string> = {
    consumption: '油耗异常',
    tank_level: '油舱存量异常',
    engine: '主机运行异常'
  }

  return {
    id: `anomaly_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    voyageId,
    date: dayjs().format('YYYY-MM-DD'),
    type,
    severity,
    description: typeDescriptions[type],
    expectedValue,
    actualValue,
    deviation,
    isResolved: false
  }
}

export const formatFuelAmount = (amount: number): string => {
  return amount.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

export const calculateTankPercentage = (currentLevel: number, maxLevel: number): number => {
  if (maxLevel === 0) return 0
  return Math.min(100, Math.max(0, (currentLevel / maxLevel) * 100))
}

export const getFuelColor = (percentage: number): string => {
  if (percentage > 70) return '#26A69A'
  if (percentage > 30) return '#FF9800'
  return '#F44336'
}

export const getSeverityColor = (severity: 'low' | 'medium' | 'high'): string => {
  const colors = {
    low: '#26A69A',
    medium: '#FF9800',
    high: '#F44336'
  }
  return colors[severity]
}

export const getSeverityLabel = (severity: 'low' | 'medium' | 'high'): string => {
  const labels = {
    low: '正常',
    medium: '警告',
    high: '严重'
  }
  return labels[severity]
}
