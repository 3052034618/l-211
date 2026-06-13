import React from 'react'
import { View, Text, Input, Textarea, Picker } from '@tarojs/components'
import classnames from 'classnames'
import styles from './index.module.scss'
import type { FormFieldConfig } from '@/types'

interface FormFieldProps extends FormFieldConfig {
  value: string | number
  onChange: (value: string | number) => void
  error?: string
  disabled?: boolean
}

const FormField: React.FC<FormFieldProps> = ({
  label,
  type,
  required,
  options,
  placeholder,
  unit,
  value,
  onChange,
  error,
  disabled
}) => {
  const renderInput = () => {
    if (type === 'textarea') {
      return (
        <Textarea
          className={styles.fieldTextarea}
          placeholder={placeholder}
          value={String(value)}
          onInput={(e) => onChange(e.detail.value)}
          disabled={disabled}
          maxlength={500}
        />
      )
    }

    if (type === 'select' && options) {
      const selectedOption = options.find(o => o.value === value)
      return (
        <Picker
          mode='selector'
          range={options}
          rangeKey='label'
          value={options.findIndex(o => o.value === value)}
          onChange={(e) => onChange(options[e.detail.value].value)}
          disabled={disabled}
        >
          <View className={classnames(styles.fieldSelect, !value && styles.placeholder)}>
            <Text>{selectedOption?.label || placeholder || '请选择'}</Text>
            <Text className={styles.selectArrow}>▼</Text>
          </View>
        </Picker>
      )
    }

    if (type === 'date') {
      return (
        <Picker
          mode='date'
          value={String(value)}
          onChange={(e) => onChange(e.detail.value)}
          disabled={disabled}
        >
          <View className={classnames(styles.fieldSelect, !value && styles.placeholder)}>
            <Text>{value || placeholder || '请选择日期'}</Text>
            <Text className={styles.selectArrow}>▼</Text>
          </View>
        </Picker>
      )
    }

    return (
      <View className={styles.inputWrapper}>
        <Input
          className={styles.fieldInput}
          type={type === 'number' ? 'digit' : 'text'}
          placeholder={placeholder}
          value={String(value)}
          onInput={(e) => onChange(type === 'number' ? Number(e.detail.value) : e.detail.value)}
          disabled={disabled}
        />
        {unit && <Text className={styles.fieldUnit}>{unit}</Text>}
      </View>
    )
  }

  return (
    <View className={styles.formField}>
      <View className={styles.fieldLabel}>
        <Text>{label}</Text>
        {required && <Text className={styles.required}>*</Text>}
      </View>
      {renderInput()}
      {error && <Text className={styles.fieldError}>{error}</Text>}
    </View>
  )
}

export default FormField
