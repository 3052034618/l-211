import { create } from 'zustand'
import type { 
  Voyage, Tank, RefuelRecord, EngineRecord, AnomalyRecord, 
  DailyConsumption, HandoverReport, User,
  Vessel, FleetSummary, OfflineQueueItem,
  OfflineOperationType, ExportResult, ExportType
} from '@/types'
import { 
  getCurrentVoyage, getVoyageList, saveCurrentVoyage, saveVoyageList, 
  getUser, saveUser,
  getOfflineQueue, saveOfflineQueue
} from '@/utils/storage'
import { mockVessels, mockFleetSummary } from '@/data/mockData'
import dayjs from 'dayjs'

interface VoyageState {
  user: User | null
  currentVoyage: Voyage | null
  voyageList: Voyage[]
  isLoading: boolean
  isOffline: boolean
  
  // 船队管理
  vessels: Vessel[]
  fleetSummary: FleetSummary | null
  
  // 离线队列
  offlineQueue: OfflineQueueItem[]
  isSyncing: boolean
  syncProgress: number
  
  // 用户管理
  setUser: (user: User) => void
  setCurrentVoyage: (voyage: Voyage | null) => void
  setVoyageList: (voyages: Voyage[]) => void
  setIsOffline: (offline: boolean) => void
  
  // 航次管理
  createVoyage: (voyageData: Partial<Voyage>) => Voyage
  updateVoyage: (voyageId: string, updates: Partial<Voyage>) => void
  getVoyageById: (voyageId: string) => Voyage | undefined
  
  // 记录查询
  getRefuelRecordById: (recordId: string) => { record: RefuelRecord | undefined; voyage: Voyage | undefined }
  getAnomalyRecordById: (anomalyId: string) => { record: AnomalyRecord | undefined; voyage: Voyage | undefined }
  
  // 油舱管理
  addTankRecord: (tank: Tank) => void
  updateTankRecord: (tankId: string, updates: Partial<Tank>) => void
  
  // 加油记录
  addRefuelRecord: (record: RefuelRecord) => void
  
  // 主机记录
  addEngineRecord: (record: EngineRecord) => void
  
  // 异常记录
  addAnomalyRecord: (record: AnomalyRecord) => void
  resolveAnomaly: (anomalyId: string, resolution: string, resolvedBy: string) => void
  
  // 油耗记录
  addDailyConsumption: (consumption: DailyConsumption) => void
  
  // 交接单
  generateHandoverReport: () => HandoverReport | null
  confirmHandover: (confirmedBy: string) => void
  
  // 船队管理
  loadFleetData: () => Promise<void>
  getVesselById: (vesselId: string) => Vessel | undefined
  getVesselVoyages: (vesselName: string) => Voyage[]
  
  // 离线队列
  addToOfflineQueue: (type: OfflineOperationType, voyageId: string, data: any) => void
  removeFromOfflineQueue: (itemId: string) => void
  clearOfflineQueue: () => void
  retryOfflineItem: (itemId: string) => Promise<void>
  
  // 数据同步
  syncOfflineData: () => Promise<void>
  processOfflineQueue: () => Promise<void>
  
  // 同步记录
  syncRecords: SyncRecord[]
  getSyncRecordsByVessel: (vesselId: string) => SyncRecord[]
  addSyncRecord: (record: SyncRecord) => void
  loadSyncRecords: () => Promise<void>
  
  // 导出功能
  exportDailyReport: (voyageId: string, date: string) => Promise<ExportResult>
  exportHandover: (voyageId: string) => Promise<ExportResult>
  exportFuelSummary: (voyageId: string) => Promise<ExportResult>
  
  // 基础加载
  loadData: () => Promise<void>
  syncData: () => Promise<void>
}

export const useVoyageStore = create<VoyageState>((set, get) => ({
  user: null,
  currentVoyage: null,
  voyageList: [],
  isLoading: false,
  isOffline: false,
  vessels: [],
  fleetSummary: null,
  offlineQueue: [],
  isSyncing: false,
  syncProgress: 0,
  syncRecords: [],

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

    const { voyageList, isOffline } = get()
    const updatedList = [newVoyage, ...voyageList]
    
    set({
      currentVoyage: newVoyage,
      voyageList: updatedList
    })
    
    saveCurrentVoyage(newVoyage)
    saveVoyageList(updatedList)
    
    if (isOffline) {
      get().addToOfflineQueue('create_voyage', newVoyage.id, newVoyage)
    }
    
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

  getVoyageById: (voyageId) => {
    const { voyageList, currentVoyage } = get()
    if (currentVoyage?.id === voyageId) return currentVoyage
    return voyageList.find(v => v.id === voyageId)
  },

  getRefuelRecordById: (recordId) => {
    const { voyageList, currentVoyage } = get()
    const allVoyages = currentVoyage ? [currentVoyage, ...voyageList] : voyageList
    for (const voyage of allVoyages) {
      const record = voyage.refuelRecords.find(r => r.id === recordId)
      if (record) {
        return { record, voyage }
      }
    }
    return { record: undefined, voyage: undefined }
  },

  getAnomalyRecordById: (anomalyId) => {
    const { voyageList, currentVoyage } = get()
    const allVoyages = currentVoyage ? [currentVoyage, ...voyageList] : voyageList
    for (const voyage of allVoyages) {
      const record = voyage.anomalies.find(a => a.id === anomalyId)
      if (record) {
        return { record, voyage }
      }
    }
    return { record: undefined, voyage: undefined }
  },

  addTankRecord: (tank) => {
    const { currentVoyage, isOffline } = get()
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
    
    if (isOffline) {
      get().addToOfflineQueue('update_tank', currentVoyage.id, { tankId: tank })
    }
    
    console.log('[VoyageStore] 添加油舱记录成功', tank.id)
  },

  updateTankRecord: (tankId, updates) => {
    const { currentVoyage, isOffline } = get()
    if (!currentVoyage) return

    const updatedTanks = currentVoyage.tanks.map(t =>
      t.id === tankId ? { ...t, ...updates, lastUpdate: new Date().toISOString() } : t
    )

    const currentLevel = updatedTanks.reduce((sum, t) => sum + t.currentLevel, 0)

    get().updateVoyage(currentVoyage.id, {
      tanks: updatedTanks,
      currentFuelLevel: currentLevel
    })
    
    if (isOffline) {
      get().addToOfflineQueue('update_tank', currentVoyage.id, { tankId, updates })
    }
  },

  addRefuelRecord: (record) => {
    const { currentVoyage, isOffline } = get()
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
    
    if (isOffline) {
      get().addToOfflineQueue('add_refuel', currentVoyage.id, record)
    }
    
    console.log('[VoyageStore] 添加加油记录成功', record.id)
  },

  addEngineRecord: (record) => {
    const { currentVoyage, isOffline } = get()
    if (!currentVoyage) return

    const updatedRecords = [...currentVoyage.engineRecords, record]

    get().updateVoyage(currentVoyage.id, {
      engineRecords: updatedRecords
    })
    
    if (isOffline) {
      get().addToOfflineQueue('add_engine_record', currentVoyage.id, record)
    }
    
    console.log('[VoyageStore] 添加主机记录成功', record.id)
  },

  addAnomalyRecord: (record) => {
    const { currentVoyage, isOffline } = get()
    if (!currentVoyage) return

    const updatedRecords = [...currentVoyage.anomalies, record]

    get().updateVoyage(currentVoyage.id, {
      anomalies: updatedRecords
    })
    
    console.log('[VoyageStore] 添加异常记录成功', record.id)
  },

  resolveAnomaly: (anomalyId, resolution, resolvedBy) => {
    const { currentVoyage, isOffline } = get()
    if (!currentVoyage) return

    const updatedAnomalies = currentVoyage.anomalies.map(a =>
      a.id === anomalyId
        ? { ...a, isResolved: true, resolution, resolvedBy, resolvedAt: new Date().toISOString() }
        : a
    )

    get().updateVoyage(currentVoyage.id, {
      anomalies: updatedAnomalies
    })
    
    if (isOffline) {
      get().addToOfflineQueue('resolve_anomaly', currentVoyage.id, { anomalyId, resolution, resolvedBy })
    }
    
    console.log('[VoyageStore] 异常已解决', anomalyId)
  },

  addDailyConsumption: (consumption) => {
    const { currentVoyage, isOffline } = get()
    if (!currentVoyage) return

    const updatedConsumptions = [...currentVoyage.dailyConsumptions, consumption]
    
    const totalConsumed = updatedConsumptions.reduce((sum, c) => sum + c.consumed, 0)
    const avgDaily = totalConsumed / updatedConsumptions.length

    get().updateVoyage(currentVoyage.id, {
      dailyConsumptions: updatedConsumptions,
      totalFuelConsumed: totalConsumed,
      avgDailyConsumption: Number(avgDaily.toFixed(2))
    })
    
    if (isOffline) {
      get().addToOfflineQueue('add_daily_consumption', currentVoyage.id, consumption)
    }
    
    console.log('[VoyageStore] 添加每日油耗成功', consumption.id)
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
    const { currentVoyage, isOffline } = get()
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
    
    if (isOffline) {
      get().addToOfflineQueue('confirm_handover', currentVoyage.id, { confirmedBy })
    }
    
    console.log('[VoyageStore] 交接单已确认')
  },

  loadFleetData: async () => {
    set({ isLoading: true })
    try {
      await new Promise(resolve => setTimeout(resolve, 500))
      
      const { voyageList } = get()
      
      const vesselsWithData = mockVessels.map(vessel => {
        const vesselVoyages = voyageList.filter(v => v.vesselName === vessel.name)
        const activeVoyage = vesselVoyages.find(v => v.status === 'active')
        const allAnomalies = vesselVoyages.flatMap(v => v.anomalies)
        const unresolvedAnomalies = allAnomalies.filter(a => !a.isResolved)
        
        return {
          ...vessel,
          currentFuelLevel: activeVoyage?.currentFuelLevel || vessel.currentFuelLevel,
          activeVoyageId: activeVoyage?.id,
          lastSyncedAt: activeVoyage?.syncedAt || vessel.lastSyncedAt,
          anomalyCount: allAnomalies.length,
          unresolvedAnomalyCount: unresolvedAnomalies.length
        }
      })
      
      const totalFuel = vesselsWithData.reduce((sum, v) => sum + v.currentFuelLevel, 0)
      const totalAnomalies = vesselsWithData.reduce((sum, v) => sum + v.anomalyCount, 0)
      const totalUnresolved = vesselsWithData.reduce((sum, v) => sum + v.unresolvedAnomalyCount, 0)
      const activeCount = vesselsWithData.filter(v => v.activeVoyageId).length
      
      const summary: FleetSummary = {
        totalVessels: vesselsWithData.length,
        activeVoyages: activeCount,
        totalFuelLevel: Number(totalFuel.toFixed(2)),
        totalAnomalies,
        unresolvedAnomalies: totalUnresolved,
        totalRefuelThisMonth: 1250.5,
        totalConsumptionThisMonth: 890.3
      }
      
      set({
        vessels: vesselsWithData,
        fleetSummary: summary,
        isLoading: false
      })
      
      console.log('[VoyageStore] 船队数据加载完成')
    } catch (error) {
      console.error('[VoyageStore] 船队数据加载失败', error)
      set({ isLoading: false })
    }
  },

  getVesselById: (vesselId) => {
    return get().vessels.find(v => v.id === vesselId)
  },

  getVesselVoyages: (vesselName) => {
    return get().voyageList.filter(v => v.vesselName === vesselName)
      .sort((a, b) => dayjs(b.createdAt).valueOf() - dayjs(a.createdAt).valueOf())
  },

  addToOfflineQueue: (type, voyageId, data) => {
    const { offlineQueue, getVoyageById } = get()
    const voyage = getVoyageById(voyageId)
    const newItem: OfflineQueueItem = {
      id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      voyageId,
      vesselName: voyage?.vesselName,
      data,
      createdAt: new Date().toISOString(),
      status: 'pending',
      retryCount: 0
    }
    
    const updatedQueue = [...offlineQueue, newItem]
    set({ offlineQueue: updatedQueue })
    saveOfflineQueue(updatedQueue)
    
    console.log('[VoyageStore] 已添加到离线队列', newItem.id)
  },

  removeFromOfflineQueue: (itemId) => {
    const { offlineQueue } = get()
    const updatedQueue = offlineQueue.filter(item => item.id !== itemId)
    set({ offlineQueue: updatedQueue })
    saveOfflineQueue(updatedQueue)
  },

  clearOfflineQueue: () => {
    set({ offlineQueue: [] })
    saveOfflineQueue([])
  },

  syncOfflineData: async () => {
    const { isSyncing, offlineQueue } = get()
    if (isSyncing || offlineQueue.length === 0) return
    
    set({ isSyncing: true, syncProgress: 0 })
    console.log('[VoyageStore] 开始同步离线数据...')
    
    try {
      await get().processOfflineQueue()
      
      const { currentVoyage } = get()
      if (currentVoyage) {
        get().updateVoyage(currentVoyage.id, {
          syncedAt: new Date().toISOString()
        })
      }
      
      set({ isOffline: false, isSyncing: false, syncProgress: 100 })
      console.log('[VoyageStore] 离线数据同步完成')
    } catch (error) {
      console.error('[VoyageStore] 离线数据同步失败', error)
      set({ isSyncing: false })
    }
  },

  processOfflineQueue: async () => {
    const { offlineQueue, vessels, addSyncRecord } = get()
    const pendingItems = offlineQueue.filter(item => item.status === 'pending' || item.status === 'failed')
    
    if (pendingItems.length === 0) return
    
    const total = pendingItems.length
    let completed = 0
    let successCount = 0
    let failedCount = 0
    const failedRecords: Array<{ id: string; type: string; reason: string }> = []
    const operationTypes = new Set<string>()
    const syncStartedAt = new Date().toISOString()
    
    const vesselMap = new Map<string, { vesselId: string; vesselName: string }>()
    pendingItems.forEach(item => {
      if (item.vesselName) {
        const vessel = vessels.find(v => v.name === item.vesselName)
        if (vessel) {
          vesselMap.set(item.vesselName, { vesselId: vessel.id, vesselName: vessel.name })
        }
      }
    })

    for (const item of pendingItems) {
      const startTime = Date.now()
      try {
        set(state => ({ 
          offlineQueue: state.offlineQueue.map(q => 
            q.id === item.id ? { ...q, status: 'syncing' } : q
          )
        }))
        
        operationTypes.add(item.type)
        
        await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 200))
        
        completed++
        successCount++
        set({ syncProgress: Math.round((completed / total) * 100) })
        
        const syncDuration = Date.now() - startTime
        set(state => ({
          offlineQueue: state.offlineQueue.map(q =>
            q.id === item.id 
              ? { ...q, status: 'success', syncedAt: new Date().toISOString(), syncDuration } 
              : q
          )
        }))
        
        setTimeout(() => {
          get().removeFromOfflineQueue(item.id)
        }, 2000)
        
        console.log('[VoyageStore] 离线操作同步成功', item.id)
      } catch (error) {
        console.error('[VoyageStore] 离线操作同步失败', item.id, error)
        failedCount++
        failedRecords.push({
          id: item.id,
          type: item.type,
          reason: (error as Error).message
        })
        set(state => ({
          offlineQueue: state.offlineQueue.map(q =>
            q.id === item.id 
              ? { ...q, status: 'failed', failedReason: (error as Error).message, retryCount: q.retryCount + 1 }
              : q
          )
        }))
      }
    }
    
    const syncCompletedAt = new Date().toISOString()
    const syncStatus: 'success' | 'partial' | 'failed' = 
      failedCount === 0 ? 'success' : successCount > 0 ? 'partial' : 'failed'
    
    if (vesselMap.size > 0) {
      vesselMap.forEach(({ vesselId, vesselName }) => {
        addSyncRecord({
          id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          vesselName,
          vesselId,
          syncStartedAt,
          syncCompletedAt,
          recordCount: total,
          successCount,
          failedCount,
          operationTypes: Array.from(operationTypes),
          status: syncStatus,
          failedRecords: failedCount > 0 ? failedRecords : undefined
        })
      })
    }
    
    set({ isSyncing: false, syncProgress: 100 })
  },

  retryOfflineItem: async (itemId) => {
    const { offlineQueue, processOfflineQueue } = get()
    const item = offlineQueue.find(q => q.id === itemId)
    if (!item || item.status === 'syncing') return
    
    set(state => ({
      offlineQueue: state.offlineQueue.map(q =>
        q.id === itemId ? { ...q, status: 'pending', failedReason: undefined } : q
      )
    }))
    
    await processOfflineQueue()
  },

  getSyncRecordsByVessel: (vesselId) => {
    const { syncRecords } = get()
    return syncRecords
      .filter(r => r.vesselId === vesselId)
      .sort((a, b) => dayjs(b.syncStartedAt).valueOf() - dayjs(a.syncStartedAt).valueOf())
  },

  addSyncRecord: (record) => {
    set(state => ({
      syncRecords: [...state.syncRecords, record]
    }))
    saveSyncRecords(get().syncRecords)
  },

  loadSyncRecords: async () => {
    try {
      const records = await loadSyncRecords()
      if (records) {
        set({ syncRecords: records })
      }
    } catch (error) {
      console.error('[VoyageStore] 加载同步记录失败', error)
    }
  },

  exportDailyReport: async (voyageId, date) => {
    const voyage = get().getVoyageById(voyageId)
    if (!voyage) {
      return {
        success: false,
        fileName: '',
        message: '航次不存在'
      }
    }
    
    try {
      const dailyData = voyage.dailyConsumptions.find(d => d.date === date)
      const refuelData = voyage.refuelRecords.filter(r => r.date === date)
      
      const reportContent = generateDailyReportContent(voyage, date, dailyData, refuelData)
      
      const fileName = `燃油日报_${voyage.vesselName}_${date}.txt`
      
      if (typeof window !== 'undefined') {
        const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = fileName
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      }
      
      console.log('[VoyageStore] 燃油日报导出成功', fileName)
      
      return {
        success: true,
        fileName,
        fileSize: reportContent.length,
        message: '导出成功，文件已保存'
      }
    } catch (error) {
      console.error('[VoyageStore] 燃油日报导出失败', error)
      return {
        success: false,
        fileName: '',
        message: '导出失败：' + (error as Error).message
      }
    }
  },

  exportHandover: async (voyageId) => {
    const voyage = get().getVoyageById(voyageId)
    if (!voyage) {
      return {
        success: false,
        fileName: '',
        message: '航次不存在'
      }
    }
    
    try {
      const reportContent = generateHandoverContent(voyage)
      
      const fileName = `交接单_${voyage.vesselName}_${voyage.fromPort}-${voyage.toPort}.txt`
      
      if (typeof window !== 'undefined') {
        const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = fileName
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      }
      
      console.log('[VoyageStore] 交接单导出成功', fileName)
      
      return {
        success: true,
        fileName,
        fileSize: reportContent.length,
        message: '导出成功，文件已保存'
      }
    } catch (error) {
      console.error('[VoyageStore] 交接单导出失败', error)
      return {
        success: false,
        fileName: '',
        message: '导出失败：' + (error as Error).message
      }
    }
  },

  exportFuelSummary: async (voyageId) => {
    const voyage = get().getVoyageById(voyageId)
    if (!voyage) {
      return {
        success: false,
        fileName: '',
        message: '航次不存在'
      }
    }
    
    try {
      const reportContent = generateFuelSummaryContent(voyage)
      
      const fileName = `燃油汇总_${voyage.vesselName}_${dayjs().format('YYYYMMDD')}.txt`
      
      if (typeof window !== 'undefined') {
        const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = fileName
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      }
      
      console.log('[VoyageStore] 燃油汇总导出成功', fileName)
      
      return {
        success: true,
        fileName,
        fileSize: reportContent.length,
        message: '导出成功，文件已保存'
      }
    } catch (error) {
      console.error('[VoyageStore] 燃油汇总导出失败', error)
      return {
        success: false,
        fileName: '',
        message: '导出失败：' + (error as Error).message
      }
    }
  },

  loadData: async () => {
    set({ isLoading: true })
    try {
      const [user, currentVoyage, voyageList, offlineQueue, syncRecords] = await Promise.all([
        getUser(),
        getCurrentVoyage(),
        getVoyageList(),
        getOfflineQueue(),
        loadSyncRecords()
      ])
      
      set({
        user: user as User | null,
        currentVoyage: currentVoyage as Voyage | null,
        voyageList: voyageList as Voyage[],
        offlineQueue: offlineQueue as OfflineQueueItem[],
        syncRecords: syncRecords as SyncRecord[]
      })
      
      console.log('[VoyageStore] 数据加载完成', { 
        hasUser: !!user, 
        hasCurrentVoyage: !!currentVoyage, 
        voyageCount: voyageList.length,
        offlineQueueCount: offlineQueue.length,
        syncRecordsCount: syncRecords.length
      })
    } catch (error) {
      console.error('[VoyageStore] 数据加载失败', error)
    } finally {
      set({ isLoading: false })
    }
  },

  syncData: async () => {
    console.log('[VoyageStore] 开始同步数据...')
    
    const { isOffline } = get()
    
    if (isOffline) {
      console.log('[VoyageStore] 当前离线，数据将暂存本地')
      return
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    const { currentVoyage, offlineQueue } = get()
    
    if (offlineQueue.length > 0) {
      await get().processOfflineQueue()
    }
    
    if (currentVoyage) {
      get().updateVoyage(currentVoyage.id, {
        syncedAt: new Date().toISOString()
      })
    }
    
    set({ isOffline: false })
    console.log('[VoyageStore] 数据同步完成')
  }
}))

function generateDailyReportContent(
  voyage: Voyage, 
  date: string, 
  dailyData?: DailyConsumption, 
  refuelData: RefuelRecord[]
): string {
  let content = ''
  content += '='.repeat(60) + '\n'
  content += '                    燃油日报表\n'
  content += '='.repeat(60) + '\n\n'
  
  content += `船名：${voyage.vesselName}\n`
  content += `航次：${voyage.fromPort} → ${voyage.toPort}\n`
  content += `日期：${date}\n`
  content += `船长：${voyage.captain}\n`
  content += `轮机长：${voyage.chiefEngineer}\n\n`
  
  content += '-'.repeat(60) + '\n'
  content += '一、当日油耗\n'
  content += '-'.repeat(60) + '\n'
  
  if (dailyData) {
    content += `油品类型：${dailyData.fuelType}\n`
    content += `期初存量：${dailyData.startLevel.toFixed(2)} 吨\n`
    content += `期末存量：${dailyData.endLevel.toFixed(2)} 吨\n`
    content += `当日加油量：${dailyData.refueled.toFixed(2)} 吨\n`
    content += `当日消耗：${dailyData.consumed.toFixed(2)} 吨\n`
    content += `主机运行：${dailyData.engineHours} 小时\n`
    content += `航行距离：${dailyData.distance.toFixed(1)} 海里\n`
    content += `平均航速：${dailyData.avgSpeed.toFixed(1)} 节\n`
    content += `天气情况：${dailyData.weather}\n`
  } else {
    content += '当日无油耗记录\n'
  }
  
  content += '\n'
  content += '-'.repeat(60) + '\n'
  content += '二、当日加油\n'
  content += '-'.repeat(60) + '\n'
  
  if (refuelData.length > 0) {
    refuelData.forEach((record, index) => {
      content += `${index + 1}. ${record.port} - ${record.tankName}\n`
      content += `   数量：${record.quantity} 吨\n`
      content += `   单价：¥${record.unitPrice.toLocaleString()} 元/吨\n`
      content += `   金额：¥${record.totalAmount.toLocaleString()} 元\n`
      content += `   供应商：${record.supplier}\n`
      if (record.remarks) {
        content += `   备注：${record.remarks}\n`
      }
      content += '\n'
    })
  } else {
    content += '当日无加油记录\n'
  }
  
  content += '\n'
  content += '-'.repeat(60) + '\n'
  content += '三、油舱存量\n'
  content += '-'.repeat(60) + '\n'
  
  voyage.tanks.forEach(tank => {
    const percentage = ((tank.currentLevel / tank.capacity) * 100).toFixed(1)
    content += `${tank.name}：${tank.currentLevel.toFixed(2)} / ${tank.capacity} 吨 (${percentage}%)\n`
  })
  
  content += '\n'
  content += '='.repeat(60) + '\n'
  content += `生成时间：${new Date().toLocaleString()}\n`
  content += '='.repeat(60) + '\n'
  
  return content
}

function generateHandoverContent(voyage: Voyage): string {
  let content = ''
  content += '='.repeat(60) + '\n'
  content += '                    燃油交接单\n'
  content += '='.repeat(60) + '\n\n'
  
  content += `船名：${voyage.vesselName}\n`
  content += `船型：${voyage.vesselType}\n`
  content += `航线：${voyage.fromPort} → ${voyage.toPort}\n`
  content += `开航日期：${dayjs(voyage.departureDate).format('YYYY-MM-DD')}\n`
  if (voyage.arrivalDate) {
    content += `抵达日期：${dayjs(voyage.arrivalDate).format('YYYY-MM-DD')}\n`
  }
  content += `船长：${voyage.captain}\n`
  content += `轮机长：${voyage.chiefEngineer}\n\n`
  
  content += '-'.repeat(60) + '\n'
  content += '一、航次统计\n'
  content += '-'.repeat(60) + '\n'
  
  const totalRefueled = voyage.refuelRecords.reduce((sum, r) => sum + r.quantity, 0)
  const totalConsumed = voyage.dailyConsumptions.reduce((sum, c) => sum + c.consumed, 0)
  const totalDistance = voyage.dailyConsumptions.reduce((sum, c) => sum + c.distance, 0)
  const avgDaily = voyage.dailyConsumptions.length > 0 
    ? totalConsumed / voyage.dailyConsumptions.length 
    : 0
  
  content += `航行天数：${voyage.dailyConsumptions.length} 天\n`
  content += `航行总距离：${totalDistance.toFixed(1)} 海里\n`
  content += `总加油量：${totalRefueled.toFixed(2)} 吨\n`
  content += `总耗油量：${totalConsumed.toFixed(2)} 吨\n`
  content += `日均油耗：${avgDaily.toFixed(2)} 吨/天\n`
  content += `剩余油量：${voyage.currentFuelLevel.toFixed(2)} 吨\n\n`
  
  content += '-'.repeat(60) + '\n'
  content += '二、油舱存量交接\n'
  content += '-'.repeat(60) + '\n'
  
  voyage.tanks.forEach(tank => {
    const percentage = ((tank.currentLevel / tank.capacity) * 100).toFixed(1)
    content += `${tank.name}（${tank.fuelType}）：\n`
    content += `  存量：${tank.currentLevel.toFixed(2)} / ${tank.capacity} 吨 (${percentage}%)\n\n`
  })
  
  content += '\n'
  content += '-'.repeat(60) + '\n'
  content += '三、加油记录汇总\n'
  content += '-'.repeat(60) + '\n'
  
  if (voyage.refuelRecords.length > 0) {
    voyage.refuelRecords.forEach((record, index) => {
      content += `${index + 1}. ${record.date} ${record.port}\n`
      content += `   ${record.tankName}：${record.quantity} 吨 × ¥${record.unitPrice.toLocaleString()} = ¥${record.totalAmount.toLocaleString()}\n\n`
    })
  } else {
    content += '本航次无加油记录\n'
  }
  
  content += '\n'
  content += '-'.repeat(60) + '\n'
  content += '四、异常记录\n'
  content += '-'.repeat(60) + '\n'
  
  if (voyage.anomalies.length > 0) {
    voyage.anomalies.forEach((anomaly, index) => {
      const status = anomaly.isResolved ? '已处理' : '未处理'
      content += `${index + 1}. ${anomaly.date} - ${anomaly.description} [${status}]\n`
      content += `   期望值：${anomaly.expectedValue}，实际值：${anomaly.actualValue}，偏差：${anomaly.deviation}%\n`
      if (anomaly.isResolved && anomaly.resolution) {
        content += `   处理说明：${anomaly.resolution}\n`
        content += `   处理人：${anomaly.resolvedBy}，处理时间：${anomaly.resolvedAt}\n`
      }
      content += '\n'
    })
  } else {
    content += '本航次无异常记录\n'
  }
  
  content += '\n'
  content += '='.repeat(60) + '\n'
  content += '交接确认：\n\n'
  content += '交班人：_______________  日期：___________\n\n'
  content += '接班人：_______________  日期：___________\n\n'
  content += '='.repeat(60) + '\n'
  content += `生成时间：${new Date().toLocaleString()}\n`
  content += '='.repeat(60) + '\n'
  
  return content
}

function generateFuelSummaryContent(voyage: Voyage): string {
  let content = ''
  content += '='.repeat(60) + '\n'
  content += '                    燃油汇总表\n'
  content += '='.repeat(60) + '\n\n'
  
  content += `船名：${voyage.vesselName}\n`
  content += `航次：${voyage.fromPort} → ${voyage.toPort}\n`
  content += `统计日期：${new Date().toLocaleDateString()}\n\n`
  
  content += '-'.repeat(60) + '\n'
  content += '一、当前油舱存量\n'
  content += '-'.repeat(60) + '\n'
  
  const fuelTypeMap = new Map<string, { total: number; capacity: number }>()
  voyage.tanks.forEach(tank => {
    const existing = fuelTypeMap.get(tank.fuelType) || { total: 0, capacity: 0 }
    existing.total += tank.currentLevel
    existing.capacity += tank.capacity
    fuelTypeMap.set(tank.fuelType, existing)
  })
  
  fuelTypeMap.forEach((value, fuelType) => {
    const percentage = ((value.total / value.capacity) * 100).toFixed(1)
    content += `${fuelType}：${value.total.toFixed(2)} / ${value.capacity} 吨 (${percentage}%)\n`
  })
  
  content += `\n总存量：${voyage.currentFuelLevel.toFixed(2)} 吨\n\n`
  
  content += '-'.repeat(60) + '\n'
  content += '二、按港口加油汇总\n'
  content += '-'.repeat(60) + '\n'
  
  const portMap = new Map<string, { quantity: number; amount: number; count: number }>()
  voyage.refuelRecords.forEach(record => {
    const existing = portMap.get(record.port) || { quantity: 0, amount: 0, count: 0 }
    existing.quantity += record.quantity
    existing.amount += record.totalAmount
    existing.count += 1
    portMap.set(record.port, existing)
  })
  
  if (portMap.size > 0) {
    let index = 1
    portMap.forEach((value, port) => {
      content += `${index}. ${port}\n`
      content += `   加油次数：${value.count} 次\n`
      content += `   加油总量：${value.quantity.toFixed(2)} 吨\n`
      content += `   总金额：¥${value.amount.toLocaleString()} 元\n\n`
      index++
    })
  } else {
    content += '暂无加油记录\n'
  }
  
  content += '\n'
  content += '-'.repeat(60) + '\n'
  content += '三、油耗统计\n'
  content += '-'.repeat(60) + '\n'
  
  const totalConsumed = voyage.dailyConsumptions.reduce((sum, c) => sum + c.consumed, 0)
  const totalDistance = voyage.dailyConsumptions.reduce((sum, c) => sum + c.distance, 0)
  const avgDaily = voyage.dailyConsumptions.length > 0 
    ? totalConsumed / voyage.dailyConsumptions.length 
    : 0
  
  content += `记录天数：${voyage.dailyConsumptions.length} 天\n`
  content += `总耗油量：${totalConsumed.toFixed(2)} 吨\n`
  content += `日均油耗：${avgDaily.toFixed(2)} 吨/天\n`
  content += `总航行距离：${totalDistance.toFixed(1)} 海里\n`
  content += `百海里油耗：${totalDistance > 0 ? ((totalConsumed / totalDistance) * 100).toFixed(2) : '0'} 吨/百海里\n\n`
  
  content += '='.repeat(60) + '\n'
  content += `生成时间：${new Date().toLocaleString()}\n`
  content += '='.repeat(60) + '\n'
  
  return content
}
