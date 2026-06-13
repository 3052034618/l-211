import { create } from 'zustand'
import type { Voyage, Tank, RefuelRecord, EngineRecord, AnomalyRecord, DailyConsumption, HandoverReport, User } from '@/types'
import { getCurrentVoyage, getVoyageList, saveCurrentVoyage, saveVoyageList, getUser, saveUser } from '@/utils/storage'

interface VoyageState {
  user: User | null
  currentVoyage: Voyage | null
  voyageList: Voyage[]
  isLoading: boolean
  isOffline: boolean
  
  setUser: (user: User) => void
  setCurrentVoyage: (voyage: Voyage | null) => void
  setVoyageList: (voyages: Voyage[]) => void
  setIsOffline: (offline: boolean) => void
  
  createVoyage: (voyageData: Partial<Voyage>) => Voyage
  updateVoyage: (voyageId: string, updates: Partial<Voyage>) => void
  
  addTankRecord: (tank: Tank) => void
  updateTankRecord: (tankId: string, updates: Partial<Tank>) => void
  
  addRefuelRecord: (record: RefuelRecord) => void
  addEngineRecord: (record: EngineRecord) => void
  addAnomalyRecord: (record: AnomalyRecord) => void
  addDailyConsumption: (consumption: DailyConsumption) => void
  
  resolveAnomaly: (anomalyId: string, resolution: string, resolvedBy: string) => void
  
  generateHandoverReport: () => HandoverReport | null
  confirmHandover: (confirmedBy: string) => void
  
  loadData: () => Promise<void>
  syncData: () => Promise<void>
}

export const useVoyageStore = create<VoyageState>((set, get) => ({
  user: null,
  currentVoyage: null,
  voyageList: [],
  isLoading: false,
  isOffline: false,

  setUser: (user) => {
    set({ user })
    saveUser(user)
  },

  setCurrentVoyage: (voyage) => {
    set({ currentVoyage: voyage })
    if (voyage) {
      saveCurrentVoyage(voyage)
    }
  },

  setVoyageList: (voyages) => {
    set({ voyageList: voyages })
    saveVoyageList(voyages)
  },

  setIsOffline: (offline) => set({ isOffline: offline }),

  createVoyage: (voyageData) => {
    const now = new Date().toISOString()
    const newVoyage: Voyage = {
      id: `voyage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      vesselName: voyageData.vesselName || '',
      vesselType: voyageData.vesselType || '货船',
      fromPort: voyageData.fromPort || '',
      toPort: voyageData.toPort || '',
      departureDate: voyageData.departureDate || now,
      arrivalDate: voyageData.arrivalDate,
      captain: voyageData.captain || '',
      chiefEngineer: voyageData.chiefEngineer || '',
      status: 'active',
      totalFuelCapacity: voyageData.totalFuelCapacity || 0,
      currentFuelLevel: voyageData.currentFuelLevel || 0,
      totalDistance: voyageData.totalDistance,
      totalFuelConsumed: voyageData.totalFuelConsumed,
      avgDailyConsumption: voyageData.avgDailyConsumption,
      tanks: voyageData.tanks || [],
      refuelRecords: [],
      engineRecords: [],
      anomalies: [],
      dailyConsumptions: [],
      handoverReport: undefined,
      createdAt: now,
      updatedAt: now
    }

    const { voyageList } = get()
    const updatedList = [newVoyage, ...voyageList]
    
    set({
      currentVoyage: newVoyage,
      voyageList: updatedList
    })
    
    saveCurrentVoyage(newVoyage)
    saveVoyageList(updatedList)
    
    console.log('[VoyageStore] 创建航次成功', newVoyage.id)
    return newVoyage
  },

  updateVoyage: (voyageId, updates) => {
    const { voyageList, currentVoyage } = get()
    const now = new Date().toISOString()
    
    const updatedList = voyageList.map(v => 
      v.id === voyageId ? { ...v, ...updates, updatedAt: now } : v
    )
    
    const updatedCurrent = currentVoyage?.id === voyageId 
      ? { ...currentVoyage, ...updates, updatedAt: now } 
      : currentVoyage
    
    set({
      voyageList: updatedList,
      currentVoyage: updatedCurrent
    })
    
    saveVoyageList(updatedList)
    if (updatedCurrent) {
      saveCurrentVoyage(updatedCurrent)
    }
    
    console.log('[VoyageStore] 更新航次成功', voyageId)
  },

  addTankRecord: (tank) => {
    const { currentVoyage } = get()
    if (!currentVoyage) {
      console.error('[VoyageStore] 没有当前航次，无法添加油舱记录')
      return
    }

    const existingIndex = currentVoyage.tanks.findIndex(t => t.id === tank.id)
    let updatedTanks: Tank[]
    
    if (existingIndex >= 0) {
      updatedTanks = [...currentVoyage.tanks]
      updatedTanks[existingIndex] = { ...updatedTanks[existingIndex], ...tank }
    } else {
      updatedTanks = [...currentVoyage.tanks, tank]
    }

    const currentLevel = updatedTanks.reduce((sum, t) => sum + t.currentLevel, 0)

    get().updateVoyage(currentVoyage.id, {
      tanks: updatedTanks,
      currentFuelLevel: currentLevel
    })
    
    console.log('[VoyageStore] 添加油舱记录成功', tank.id)
  },

  updateTankRecord: (tankId, updates) => {
    const { currentVoyage } = get()
    if (!currentVoyage) return

    const updatedTanks = currentVoyage.tanks.map(t =>
      t.id === tankId ? { ...t, ...updates, lastUpdate: new Date().toISOString() } : t
    )

    const currentLevel = updatedTanks.reduce((sum, t) => sum + t.currentLevel, 0)

    get().updateVoyage(currentVoyage.id, {
      tanks: updatedTanks,
      currentFuelLevel: currentLevel
    })
  },

  addRefuelRecord: (record) => {
    const { currentVoyage } = get()
    if (!currentVoyage) return

    const updatedRecords = [...currentVoyage.refuelRecords, record]
    
    const updatedTanks = currentVoyage.tanks.map(t =>
      t.id === record.tankId
        ? { ...t, currentLevel: t.currentLevel + record.quantity, lastUpdate: record.date }
        : t
    )

    const currentLevel = updatedTanks.reduce((sum, t) => sum + t.currentLevel, 0)

    get().updateVoyage(currentVoyage.id, {
      refuelRecords: updatedRecords,
      tanks: updatedTanks,
      currentFuelLevel: currentLevel
    })
    
    console.log('[VoyageStore] 添加加油记录成功', record.id)
  },

  addEngineRecord: (record) => {
    const { currentVoyage } = get()
    if (!currentVoyage) return

    const updatedRecords = [...currentVoyage.engineRecords, record]

    get().updateVoyage(currentVoyage.id, {
      engineRecords: updatedRecords
    })
    
    console.log('[VoyageStore] 添加主机记录成功', record.id)
  },

  addAnomalyRecord: (record) => {
    const { currentVoyage } = get()
    if (!currentVoyage) return

    const updatedRecords = [...currentVoyage.anomalies, record]

    get().updateVoyage(currentVoyage.id, {
      anomalies: updatedRecords
    })
    
    console.log('[VoyageStore] 添加异常记录成功', record.id)
  },

  addDailyConsumption: (consumption) => {
    const { currentVoyage } = get()
    if (!currentVoyage) return

    const updatedConsumptions = [...currentVoyage.dailyConsumptions, consumption]
    
    const totalConsumed = updatedConsumptions.reduce((sum, c) => sum + c.consumed, 0)
    const avgDaily = totalConsumed / updatedConsumptions.length

    get().updateVoyage(currentVoyage.id, {
      dailyConsumptions: updatedConsumptions,
      totalFuelConsumed: totalConsumed,
      avgDailyConsumption: Number(avgDaily.toFixed(2))
    })
    
    console.log('[VoyageStore] 添加每日油耗成功', consumption.id)
  },

  resolveAnomaly: (anomalyId, resolution, resolvedBy) => {
    const { currentVoyage } = get()
    if (!currentVoyage) return

    const updatedAnomalies = currentVoyage.anomalies.map(a =>
      a.id === anomalyId
        ? { ...a, isResolved: true, resolution, resolvedBy, resolvedAt: new Date().toISOString() }
        : a
    )

    get().updateVoyage(currentVoyage.id, {
      anomalies: updatedAnomalies
    })
    
    console.log('[VoyageStore] 异常已解决', anomalyId)
  },

  generateHandoverReport: () => {
    const { currentVoyage, user } = get()
    if (!currentVoyage || !user) return null

    const totalRefueled = currentVoyage.refuelRecords.reduce((sum, r) => sum + r.quantity, 0)
    const totalConsumed = currentVoyage.dailyConsumptions.reduce((sum, c) => sum + c.consumed, 0)
    const avgDaily = currentVoyage.dailyConsumptions.length > 0
      ? totalConsumed / currentVoyage.dailyConsumptions.length
      : 0

    const report: HandoverReport = {
      id: `handover_${Date.now()}`,
      voyageId: currentVoyage.id,
      vesselName: currentVoyage.vesselName,
      fromPort: currentVoyage.fromPort,
      toPort: currentVoyage.toPort,
      departureDate: currentVoyage.departureDate,
      arrivalDate: currentVoyage.arrivalDate || new Date().toISOString(),
      totalFuelConsumed: Number(totalConsumed.toFixed(2)),
      totalRefueled: Number(totalRefueled.toFixed(2)),
      avgDailyConsumption: Number(avgDaily.toFixed(2)),
      tankLevels: currentVoyage.tanks.map(t => ({
        tankId: t.id,
        tankName: t.name,
        level: t.currentLevel,
        fuelType: t.fuelType
      })),
      anomalies: currentVoyage.anomalies,
      preparedBy: user.name,
      status: 'draft'
    }

    get().updateVoyage(currentVoyage.id, {
      handoverReport: report
    })

    console.log('[VoyageStore] 生成交接单成功', report.id)
    return report
  },

  confirmHandover: (confirmedBy) => {
    const { currentVoyage } = get()
    if (!currentVoyage?.handoverReport) return

    const updatedReport: HandoverReport = {
      ...currentVoyage.handoverReport,
      confirmedBy,
      confirmedAt: new Date().toISOString(),
      status: 'confirmed'
    }

    get().updateVoyage(currentVoyage.id, {
      handoverReport: updatedReport,
      status: 'completed'
    })
    
    console.log('[VoyageStore] 交接单已确认')
  },

  loadData: async () => {
    set({ isLoading: true })
    try {
      const [user, currentVoyage, voyageList] = await Promise.all([
        getUser(),
        getCurrentVoyage(),
        getVoyageList()
      ])
      
      set({
        user: user as User | null,
        currentVoyage: currentVoyage as Voyage | null,
        voyageList: voyageList as Voyage[]
      })
      
      console.log('[VoyageStore] 数据加载完成', { 
        hasUser: !!user, 
        hasCurrentVoyage: !!currentVoyage, 
        voyageCount: voyageList.length 
      })
    } catch (error) {
      console.error('[VoyageStore] 数据加载失败', error)
    } finally {
      set({ isLoading: false })
    }
  },

  syncData: async () => {
    console.log('[VoyageStore] 开始同步数据...')
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    const { currentVoyage } = get()
    if (currentVoyage) {
      get().updateVoyage(currentVoyage.id, {
        syncedAt: new Date().toISOString()
      })
    }
    
    set({ isOffline: false })
    console.log('[VoyageStore] 数据同步完成')
  }
}))
