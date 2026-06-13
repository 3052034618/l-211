import type { Voyage, Tank, RefuelRecord, EngineRecord, AnomalyRecord, DailyConsumption, User } from '@/types'
import dayjs from 'dayjs'

export const mockUser: User = {
  id: 'user_001',
  name: '张明',
  role: 'engineer',
  vesselName: '远洋号'
}

export const mockTanks: Tank[] = [
  {
    id: 'tank_001',
    name: '1号重油舱',
    capacity: 500,
    currentLevel: 380,
    maxLevel: 500,
    fuelType: '重油',
    lastUpdate: dayjs().format('YYYY-MM-DD HH:mm:ss')
  },
  {
    id: 'tank_002',
    name: '2号重油舱',
    capacity: 500,
    currentLevel: 420,
    maxLevel: 500,
    fuelType: '重油',
    lastUpdate: dayjs().format('YYYY-MM-DD HH:mm:ss')
  },
  {
    id: 'tank_003',
    name: '3号柴油舱',
    capacity: 200,
    currentLevel: 150,
    maxLevel: 200,
    fuelType: '柴油',
    lastUpdate: dayjs().format('YYYY-MM-DD HH:mm:ss')
  },
  {
    id: 'tank_004',
    name: '4号柴油舱',
    capacity: 200,
    currentLevel: 85,
    maxLevel: 200,
    fuelType: '柴油',
    lastUpdate: dayjs().format('YYYY-MM-DD HH:mm:ss')
  }
]

export const mockRefuelRecords: RefuelRecord[] = [
  {
    id: 'refuel_001',
    voyageId: 'voyage_001',
    date: dayjs().subtract(5, 'day').format('YYYY-MM-DD'),
    port: '上海港',
    tankId: 'tank_001',
    tankName: '1号重油舱',
    quantity: 200,
    unitPrice: 5200,
    totalAmount: 1040000,
    fuelType: '重油',
    supplier: '中石化燃料油',
    remarks: '港内加油，油品检验合格',
    operator: '张明',
    createdAt: dayjs().subtract(5, 'day').format('YYYY-MM-DD HH:mm:ss')
  },
  {
    id: 'refuel_002',
    voyageId: 'voyage_001',
    date: dayjs().subtract(3, 'day').format('YYYY-MM-DD'),
    port: '宁波舟山港',
    tankId: 'tank_003',
    tankName: '3号柴油舱',
    quantity: 100,
    unitPrice: 7800,
    totalAmount: 780000,
    fuelType: '柴油',
    supplier: '中海油',
    remarks: '锚地加油',
    operator: '张明',
    createdAt: dayjs().subtract(3, 'day').format('YYYY-MM-DD HH:mm:ss')
  }
]

export const mockEngineRecords: EngineRecord[] = Array.from({ length: 7 }, (_, i) => ({
  id: `engine_00${i + 1}`,
  voyageId: 'voyage_001',
  date: dayjs().subtract(6 - i, 'day').format('YYYY-MM-DD'),
  engineHours: 24,
  rpm: 95 + Math.floor(Math.random() * 10),
  power: 8500 + Math.floor(Math.random() * 500),
  fuelConsumption: 12 + Math.random() * 3,
  speed: 12 + Math.random() * 2,
  weather: ['晴', '多云', '小雨', '阴', '晴', '多云', '晴'][i],
  windSpeed: 3 + Math.floor(Math.random() * 5),
  waveHeight: 0.5 + Math.random() * 1.5,
  operator: '张明',
  createdAt: dayjs().subtract(6 - i, 'day').format('YYYY-MM-DD HH:mm:ss')
}))

export const mockAnomalyRecords: AnomalyRecord[] = [
  {
    id: 'anomaly_001',
    voyageId: 'voyage_001',
    date: dayjs().subtract(4, 'day').format('YYYY-MM-DD'),
    type: 'consumption',
    severity: 'medium',
    description: '油耗异常偏高',
    expectedValue: 12.5,
    actualValue: 15.2,
    deviation: 21.6,
    isResolved: true,
    resolvedBy: '张明',
    resolvedAt: dayjs().subtract(3, 'day').format('YYYY-MM-DD HH:mm:ss'),
    resolution: '逆风航行，油耗正常偏高'
  },
  {
    id: 'anomaly_002',
    voyageId: 'voyage_001',
    date: dayjs().subtract(1, 'day').format('YYYY-MM-DD'),
    type: 'tank_level',
    severity: 'low',
    description: '油舱存量下降过快',
    expectedValue: 390,
    actualValue: 380,
    deviation: 2.56,
    isResolved: false
  }
]

export const mockDailyConsumptions: DailyConsumption[] = Array.from({ length: 7 }, (_, i) => {
  const startLevel = 450 - i * 12
  const endLevel = startLevel - 12 - Math.random() * 3
  return {
    id: `daily_00${i + 1}`,
    date: dayjs().subtract(6 - i, 'day').format('YYYY-MM-DD'),
    fuelType: '重油',
    startLevel: Number(startLevel.toFixed(2)),
    endLevel: Number(endLevel.toFixed(2)),
    refueled: i === 2 ? 200 : 0,
    consumed: Number((startLevel + (i === 2 ? 200 : 0) - endLevel).toFixed(2)),
    engineHours: 24,
    distance: 280 + Math.floor(Math.random() * 40),
    avgSpeed: 11.5 + Math.random() * 1.5,
    weather: ['晴', '多云', '小雨', '阴', '晴', '多云', '晴'][i]
  }
})

export const mockCurrentVoyage: Voyage = {
  id: 'voyage_001',
  vesselName: '远洋号',
  vesselType: '散货船',
  fromPort: '上海港',
  toPort: '新加坡港',
  departureDate: dayjs().subtract(7, 'day').format('YYYY-MM-DD'),
  captain: '李船长',
  chiefEngineer: '王轮机长',
  status: 'active',
  totalFuelCapacity: 1400,
  currentFuelLevel: 1035,
  totalDistance: 1850,
  totalFuelConsumed: 98.5,
  avgDailyConsumption: 14.07,
  tanks: mockTanks,
  refuelRecords: mockRefuelRecords,
  engineRecords: mockEngineRecords,
  anomalies: mockAnomalyRecords,
  dailyConsumptions: mockDailyConsumptions,
  createdAt: dayjs().subtract(7, 'day').format('YYYY-MM-DD HH:mm:ss'),
  updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
  syncedAt: dayjs().subtract(1, 'hour').format('YYYY-MM-DD HH:mm:ss')
}

export const mockVoyageList: Voyage[] = [
  mockCurrentVoyage,
  {
    id: 'voyage_002',
    vesselName: '远洋号',
    vesselType: '散货船',
    fromPort: '深圳港',
    toPort: '上海港',
    departureDate: dayjs().subtract(20, 'day').format('YYYY-MM-DD'),
    arrivalDate: dayjs().subtract(10, 'day').format('YYYY-MM-DD'),
    captain: '李船长',
    chiefEngineer: '王轮机长',
    status: 'completed',
    totalFuelCapacity: 1400,
    currentFuelLevel: 850,
    totalDistance: 920,
    totalFuelConsumed: 156.8,
    avgDailyConsumption: 15.68,
    tanks: mockTanks.map(t => ({ ...t, currentLevel: t.currentLevel - 50 })),
    refuelRecords: [],
    engineRecords: [],
    anomalies: [],
    dailyConsumptions: [],
    createdAt: dayjs().subtract(20, 'day').format('YYYY-MM-DD HH:mm:ss'),
    updatedAt: dayjs().subtract(10, 'day').format('YYYY-MM-DD HH:mm:ss'),
    syncedAt: dayjs().subtract(10, 'day').format('YYYY-MM-DD HH:mm:ss')
  },
  {
    id: 'voyage_003',
    vesselName: '远洋号',
    vesselType: '散货船',
    fromPort: '青岛港',
    toPort: '深圳港',
    departureDate: dayjs().subtract(35, 'day').format('YYYY-MM-DD'),
    arrivalDate: dayjs().subtract(25, 'day').format('YYYY-MM-DD'),
    captain: '李船长',
    chiefEngineer: '王轮机长',
    status: 'completed',
    totalFuelCapacity: 1400,
    currentFuelLevel: 920,
    totalDistance: 1200,
    totalFuelConsumed: 203.4,
    avgDailyConsumption: 20.34,
    tanks: mockTanks.map(t => ({ ...t, currentLevel: t.currentLevel - 30 })),
    refuelRecords: [],
    engineRecords: [],
    anomalies: [],
    dailyConsumptions: [],
    createdAt: dayjs().subtract(35, 'day').format('YYYY-MM-DD HH:mm:ss'),
    updatedAt: dayjs().subtract(25, 'day').format('YYYY-MM-DD HH:mm:ss'),
    syncedAt: dayjs().subtract(25, 'day').format('YYYY-MM-DD HH:mm:ss')
  }
]

export const weatherOptions = [
  { label: '晴', value: '晴' },
  { label: '多云', value: '多云' },
  { label: '阴', value: '阴' },
  { label: '小雨', value: '小雨' },
  { label: '中雨', value: '中雨' },
  { label: '大雨', value: '大雨' },
  { label: '雷阵雨', value: '雷阵雨' },
  { label: '雾', value: '雾' }
]

export const vesselTypeOptions = [
  { label: '散货船', value: '散货船' },
  { label: '集装箱船', value: '集装箱船' },
  { label: '油轮', value: '油轮' },
  { label: '化学品船', value: '化学品船' },
  { label: '液化气船', value: '液化气船' },
  { label: '客轮', value: '客轮' },
  { label: '滚装船', value: '滚装船' }
]

export const fuelTypeOptions = [
  { label: '重油', value: '重油' },
  { label: '柴油', value: '柴油' },
  { label: '船用燃料油', value: '船用燃料油' },
  { label: '低硫油', value: '低硫油' }
]

export const portOptions = [
  { label: '上海港', value: '上海港' },
  { label: '宁波舟山港', value: '宁波舟山港' },
  { label: '深圳港', value: '深圳港' },
  { label: '青岛港', value: '青岛港' },
  { label: '广州港', value: '广州港' },
  { label: '天津港', value: '天津港' },
  { label: '大连港', value: '大连港' },
  { label: '厦门港', value: '厦门港' },
  { label: '苏州港', value: '苏州港' },
  { label: '日照港', value: '日照港' },
  { label: '新加坡港', value: '新加坡港' },
  { label: '香港港', value: '香港港' },
  { label: '釜山港', value: '釜山港' },
  { label: '东京港', value: '东京港' },
  { label: '横滨港', value: '横滨港' }
]
