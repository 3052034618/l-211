import Taro from '@tarojs/taro'

const STORAGE_PREFIX = 'fuel_record_'

const getKey = (key: string): string => `${STORAGE_PREFIX}${key}`

export const setStorage = <T>(key: string, data: T): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      Taro.setStorageSync(getKey(key), JSON.stringify(data))
      resolve()
    } catch (error) {
      console.error('[Storage] 存储失败', error)
      reject(error)
    }
  })
}

export const getStorage = <T>(key: string, defaultValue?: T): Promise<T | null> => {
  return new Promise((resolve) => {
    try {
      const value = Taro.getStorageSync(getKey(key))
      if (value) {
        resolve(JSON.parse(value))
      } else {
        resolve(defaultValue || null)
      }
    } catch (error) {
      console.error('[Storage] 读取失败', error)
      resolve(defaultValue || null)
    }
  })
}

export const removeStorage = (key: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      Taro.removeStorageSync(getKey(key))
      resolve()
    } catch (error) {
      console.error('[Storage] 删除失败', error)
      reject(error)
    }
  })
}

export const clearStorage = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      const info = Taro.getStorageInfoSync()
      info.keys.forEach(key => {
        if (key.startsWith(STORAGE_PREFIX)) {
          Taro.removeStorageSync(key)
        }
      })
      resolve()
    } catch (error) {
      console.error('[Storage] 清空失败', error)
      reject(error)
    }
  })
}

export const saveVoyageList = async (voyages: any[]): Promise<void> => {
  await setStorage('voyages', voyages)
}

export const getVoyageList = async (): Promise<any[]> => {
  const data = await getStorage<any[]>('voyages', [])
  return data || []
}

export const saveCurrentVoyage = async (voyage: any): Promise<void> => {
  await setStorage('currentVoyage', voyage)
}

export const getCurrentVoyage = async (): Promise<any | null> => {
  return await getStorage<any>('currentVoyage', null)
}

export const saveOfflineQueue = async (queue: any[]): Promise<void> => {
  await setStorage('offlineQueue', queue)
}

export const getOfflineQueue = async (): Promise<any[]> => {
  const data = await getStorage<any[]>('offlineQueue', [])
  return data || []
}

export const saveUser = async (user: any): Promise<void> => {
  await setStorage('user', user)
}

export const getUser = async (): Promise<any | null> => {
  return await getStorage<any>('user', null)
}
