import React, { useState, useMemo } from 'react'
import { View, Text, ScrollView, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import styles from './index.module.scss'
import { useVoyageStore } from '@/store/useVoyageStore'
import FormField from '@/components/FormField'
import { vesselTypeOptions, portOptions, fuelTypeOptions, mockTanks, mockUser } from '@/data/mockData'
import type { Tank, FormFieldConfig } from '@/types'
import dayjs from 'dayjs'

interface FormData {
  vesselName: string
  vesselType: string
  fromPort: string
  toPort: string
  departureDate: string
  captain: string
  chiefEngineer: string
  remarks: string
}

interface TankFormData extends Partial<Tank> {
  tempId?: string
}

const CreateVoyagePage: React.FC = () => {
  const { createVoyage, user, setUser } = useVoyageStore()
  const [formData, setFormData] = useState<FormData>({
    vesselName: user?.vesselName || '',
    vesselType: '散货船',
    fromPort: '',
    toPort: '',
    departureDate: dayjs().format('YYYY-MM-DD'),
    captain: '',
    chiefEngineer: '',
    remarks: ''
  })
  const [tanks, setTanks] = useState<TankFormData[]>([
    { ...mockTanks[0], tempId: `temp_${Date.now()}_1` },
    { ...mockTanks[1], tempId: `temp_${Date.now()}_2` }
  ])
  const [errors, setErrors] = useState<Record<string, string>>({})

  useDidShow(() => {
    if (!user) {
      setUser(mockUser)
    }
  })

  const basicFields: FormFieldConfig[] = [
    { key: 'vesselName', label: '船名', type: 'text', required: true, placeholder: '请输入船名' },
    { key: 'vesselType', label: '船型', type: 'select', required: true, options: vesselTypeOptions },
    { key: 'fromPort', label: '出发港', type: 'select', required: true, options: portOptions },
    { key: 'toPort', label: '目的港', type: 'select', required: true, options: portOptions },
    { key: 'departureDate', label: '开航日期', type: 'date', required: true },
    { key: 'captain', label: '船长', type: 'text', required: true, placeholder: '请输入船长姓名' },
    { key: 'chiefEngineer', label: '轮机长', type: 'text', required: true, placeholder: '请输入轮机长姓名' },
    { key: 'remarks', label: '备注', type: 'textarea', placeholder: '可选，填写其他重要信息' }
  ]

  const tankFields: FormFieldConfig[] = [
    { key: 'name', label: '油舱名称', type: 'text', required: true, placeholder: '如：1号重油舱' },
    { key: 'fuelType', label: '燃料类型', type: 'select', required: true, options: fuelTypeOptions },
    { key: 'capacity', label: '总容量', type: 'number', required: true, placeholder: '0', unit: '吨' },
    { key: 'currentLevel', label: '初始存量', type: 'number', required: true, placeholder: '0', unit: '吨' }
  ]

  const handleFieldChange = (key: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [key]: value }))
    if (errors[key]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[key]
        return newErrors
      })
    }
  }

  const handleTankFieldChange = (tempId: string, key: string, value: string | number) => {
    setTanks(prev => prev.map(t =>
      t.tempId === tempId ? { ...t, [key]: value } : t
    ))
  }

  const addTank = () => {
    const newTank: TankFormData = {
      tempId: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: '',
      fuelType: '重油',
      capacity: 0,
      currentLevel: 0,
      maxLevel: 0,
      lastUpdate: dayjs().format('YYYY-MM-DD HH:mm:ss')
    }
    setTanks(prev => [...prev, newTank])
  }

  const removeTank = (tempId: string) => {
    if (tanks.length <= 1) {
      Taro.showToast({ title: '至少保留一个油舱', icon: 'none' })
      return
    }
    setTanks(prev => prev.filter(t => t.tempId !== tempId))
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    basicFields.forEach(field => {
      if (field.required && !formData[field.key as keyof FormData]) {
        newErrors[field.key] = `请${field.type === 'select' ? '选择' : '填写'}${field.label}`
      }
    })

    if (formData.fromPort && formData.toPort && formData.fromPort === formData.toPort) {
      newErrors.toPort = '出发港和目的港不能相同'
    }

    tanks.forEach((tank, index) => {
      if (!tank.name) newErrors[`tank_${index}_name`] = '请填写油舱名称'
      if (!tank.capacity || tank.capacity <= 0) newErrors[`tank_${index}_capacity`] = '请输入有效容量'
      if (tank.currentLevel === undefined || tank.currentLevel < 0) newErrors[`tank_${index}_currentLevel`] = '请输入有效存量'
      if (tank.currentLevel && tank.capacity && tank.currentLevel > tank.capacity) {
        newErrors[`tank_${index}_currentLevel`] = '存量不能超过容量'
      }
    })

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const summary = useMemo(() => {
    const totalCapacity = tanks.reduce((sum, t) => sum + (Number(t.capacity) || 0), 0)
    const totalLevel = tanks.reduce((sum, t) => sum + (Number(t.currentLevel) || 0), 0)
    const remaining = totalCapacity - totalLevel
    const percentage = totalCapacity > 0 ? (totalLevel / totalCapacity) * 100 : 0

    return {
      totalCapacity: totalCapacity.toFixed(2),
      totalLevel: totalLevel.toFixed(2),
      remaining: remaining.toFixed(2),
      percentage: percentage.toFixed(1)
    }
  }, [tanks])

  const handleSubmit = () => {
    if (!validateForm()) {
      Taro.showToast({ title: '请完善表单信息', icon: 'none' })
      return
    }

    const validTanks: Tank[] = tanks.map(t => ({
      id: `tank_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: t.name || '',
      capacity: Number(t.capacity) || 0,
      currentLevel: Number(t.currentLevel) || 0,
      maxLevel: Number(t.capacity) || 0,
      fuelType: t.fuelType || '重油',
      lastUpdate: dayjs().format('YYYY-MM-DD HH:mm:ss')
    }))

    const newVoyage = createVoyage({
      ...formData,
      tanks: validTanks,
      totalFuelCapacity: Number(summary.totalCapacity),
      currentFuelLevel: Number(summary.totalLevel)
    })

    Taro.showModal({
      title: '创建成功',
      content: `航次已创建，是否立即开始记录？`,
      confirmText: '开始记录',
      cancelText: '稍后再说',
      success: (res) => {
        if (res.confirm) {
          Taro.switchTab({ url: '/pages/voyage/index' })
        } else {
          Taro.navigateBack()
        }
      }
    })

    console.log('[CreateVoyage] 创建航次成功', newVoyage.id)
  }

  const handleCancel = () => {
    Taro.showModal({
      title: '确认取消',
      content: '取消后已填写的信息将不会保存',
      success: (res) => {
        if (res.confirm) {
          Taro.navigateBack()
        }
      }
    })
  }

  return (
    <ScrollView className={styles.page} scrollY>
      <View className={styles.header}>
        <Text className={styles.title}>创建新航次</Text>
        <Text className={styles.subtitle}>填写航次基本信息和油舱配置</Text>
      </View>

      <View className={styles.formContainer}>
        <View className={styles.formCard}>
          <View className={styles.sectionTitle}>
            <Text className={styles.icon}>🚢</Text>
            <Text>基本信息</Text>
          </View>
          {basicFields.map(field => {
            const { key, ...fieldProps } = field
            return (
              <FormField
                key={key}
                {...fieldProps}
                value={formData[key as keyof FormData]}
                onChange={(value) => handleFieldChange(key, value)}
                error={errors[key]}
              />
            )
          })}
        </View>

        <View className={styles.tankSection}>
          <View className={styles.tankHeader}>
            <View className={styles.title}>
              <Text className={styles.icon}>🛢️</Text>
              <Text>油舱配置</Text>
            </View>
            <View className={styles.addBtn} onClick={addTank}>
              <Text>➕</Text>
              <Text>添加油舱</Text>
            </View>
          </View>

          {tanks.length > 0 ? (
            tanks.map((tank, index) => (
              <View key={tank.tempId} className={styles.tankItem}>
                <View className={styles.tankHeaderRow}>
                  <Text className={styles.tankName}>油舱 {index + 1}</Text>
                  <Text className={styles.removeBtn} onClick={() => removeTank(tank.tempId!)}>
                    删除
                  </Text>
                </View>
                <View className={styles.tankFields}>
                  {tankFields.map(field => {
                    const { key, ...fieldProps } = field
                    return (
                      <FormField
                        key={`${tank.tempId}_${key}`}
                        {...fieldProps}
                        value={tank[key as keyof Tank] || ''}
                        onChange={(value) => handleTankFieldChange(tank.tempId!, key, value)}
                        error={errors[`tank_${index}_${key}`]}
                      />
                    )
                  })}
                </View>
              </View>
            ))
          ) : (
            <View className={styles.emptyTank}>
              <Text className={styles.icon}>🛢️</Text>
              <Text>点击上方按钮添加油舱</Text>
            </View>
          )}
        </View>

        <View className={styles.summaryCard}>
          <Text className={styles.summaryTitle}>📊 油舱配置汇总</Text>
          <View className={styles.summaryRow}>
            <Text className={styles.label}>油舱数量</Text>
            <Text className={styles.value}>{tanks.length} 个</Text>
          </View>
          <View className={styles.summaryRow}>
            <Text className={styles.label}>总容量</Text>
            <Text className={styles.value}>{summary.totalCapacity} 吨</Text>
          </View>
          <View className={styles.summaryRow}>
            <Text className={styles.label}>初始存量</Text>
            <Text className={styles.value}>{summary.totalLevel} 吨</Text>
          </View>
          <View className={styles.summaryRow}>
            <Text className={styles.label}>装载率</Text>
            <Text className={styles.value}>{summary.percentage}%</Text>
          </View>
        </View>
      </View>

      <View className={styles.bottomBar}>
        <Button className={styles.btnCancel} onClick={handleCancel}>取消</Button>
        <Button className={styles.btnSubmit} onClick={handleSubmit}>创建航次</Button>
      </View>
    </ScrollView>
  )
}

export default CreateVoyagePage
