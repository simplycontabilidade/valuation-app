import * as React from 'react'
import { Input } from '@/ui/components/ui/input'
import { cn } from '@/lib/utils'

interface NumberInputProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  suffix?: string
  prefix?: string
  className?: string
  disabled?: boolean
  placeholder?: string
  /** If true, interpret as percentage: display value*100, store as decimal */
  asPercent?: boolean
}

export function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  prefix,
  className,
  disabled,
  placeholder,
  asPercent,
}: NumberInputProps) {
  const displayValue = asPercent ? (value * 100).toFixed(2) : value.toString()
  const [localValue, setLocalValue] = React.useState(displayValue)

  React.useEffect(() => {
    setLocalValue(asPercent ? (value * 100).toFixed(2) : value.toString())
  }, [value, asPercent])

  const handleBlur = () => {
    let parsed = parseFloat(localValue.replace(',', '.'))
    if (isNaN(parsed)) parsed = 0
    if (asPercent) parsed = parsed / 100
    if (min !== undefined) parsed = Math.max(min, parsed)
    if (max !== undefined) parsed = Math.min(max, parsed)
    onChange(parsed)
    setLocalValue(asPercent ? (parsed * 100).toFixed(2) : parsed.toString())
  }

  return (
    <div className={cn('relative flex items-center', className)}>
      {prefix && (
        <span className="absolute left-3 text-sm text-muted-foreground">{prefix}</span>
      )}
      <Input
        type="text"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={(e) => e.key === 'Enter' && handleBlur()}
        step={step}
        disabled={disabled}
        placeholder={placeholder}
        className={cn(
          prefix && 'pl-8',
          suffix && 'pr-10',
        )}
      />
      {suffix && (
        <span className="absolute right-3 text-sm text-muted-foreground">{suffix}</span>
      )}
    </div>
  )
}
