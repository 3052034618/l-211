// 航次状态
export type VoyageStatus = 'active' | 'completed' | 'draft'

// 油舱类型
export interface Tank {
  id: string
  name: string
  capacity: number
  currentLevel: number
  maxLevel: number
  fuelType: string
  lastUpdate: string
}

// 加油记录
export interface RefuelRecord {
  id: string
  voyageId: string
  date: string
  port: string
  tankId: string
  tankName: string
  quantity: number
  unitPrice: number
  totalAmount: number
  fuelType: string
  supplier: string
  receiptImage?: string
  remarks?: string
  operator: string
  createdAt: string
}

// 主机运行记录
export interface EngineRecord {
  id: string
  voyageId: string
  date: string
  engineHours: number
  rpm: number
  power: number
  fuelConsumption: number
  speed: number
  weather: string
  windSpeed: number
  waveHeight: number
  remarks?: string
  operator: string
  createdAt: string
}

// 油耗异常记录
export interface AnomalyRecord {
  id: string
  voyageId: string
  date: string
  type: 'consumption' | 'tank_level' | 'engine'
  severity: 'low' | 'medium' | 'high'
  description: string
  expectedValue: number
  actualValue: number
  deviation: number
  isResolved: boolean
  resolvedBy?: string
  resolvedAt?: string
  resolution?: string
}

// 每日油耗
export interface DailyConsumption {
  id: string
  date: string
  fuelType: string
  startLevel: number
  endLevel: number
  refueled: number
  consumed: number
  engineHours: number
  distance: number
  avgSpeed: number
  weather: string
}

// 交接单
export interface HandoverReport {
  id: string
  voyageId: string
  vesselName: string
  fromPort: string
  toPort: string
  departureDate: string
  arrivalDate: string
  totalFuelConsumed: number
  totalRefueled: number
  avgDailyConsumption: number
  tankLevels: Array<{
    tankId: string
    tankName: string
    level: number
    fuelType: string
  }>
  anomalies: AnomalyRecord[]
  preparedBy: string
  confirmedBy?: string
  confirmedAt?: string
  status: 'draft' | 'pending' | 'confirmed'
}

// 航次
export interface Voyage {
  id: string
  vesselName: string
  vesselType: string
  fromPort: string
  toPort: string
  departureDate: string
  arrivalDate?: string
  captain: string
  chiefEngineer: string
  status: VoyageStatus
  totalFuelCapacity: number
  currentFuelLevel: number
  totalDistance?: number
  totalFuelConsumed?: number
  avgDailyConsumption?: number
  tanks: Tank[]
  refuelRecords: RefuelRecord[]
  engineRecords: EngineRecord[]
  anomalies: AnomalyRecord[]
  dailyConsumptions: DailyConsumption[]
  handoverReport?: HandoverReport
  createdAt: string
  updatedAt: string
  syncedAt?: string
}

// 用户角色
export type UserRole = 'captain' | 'engineer' | 'manager'

// 用户信息
export interface User {
  id: string
  name: string
  role: UserRole
  vesselName?: string
}

// 表单字段
export interface FormFieldConfig {
  key: string
  label: string
  type: 'text' | 'number' | 'date' | 'select' | 'textarea'
  required?: boolean
  options?: Array<{ label: string; value: string }>
  placeholder?: string
  unit?: string
}

// 统计卡片数据
export interface StatCardData {
  title: string
  value: string | number
  unit?: string
  trend?: 'up' | 'down' | 'stable'
  trendValue?: number
  color?: string
}
