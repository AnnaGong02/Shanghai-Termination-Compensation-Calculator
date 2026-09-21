import { describe, expect, it } from 'vitest'
import { calculate, compensationYears, type CalculatorInput } from './calculate'

const example: CalculatorInput = {
  startDate: '2020-07-01', endDate: '2026-08-31', reason: 'agreement', notice: 'yes',
  continueContract: 'no', salaryTotal: 360000, salaryMonths: 12, previousMonthSalary: null,
}

describe('补偿年限', () => {
  it('不满6个月按半个月，满6个月按1个月', () => {
    expect(compensationYears('2026-01-01', '2026-06-29')).toBe(0.5)
    expect(compensationYears('2026-01-01', '2026-06-30')).toBe(1)
  })
  it('跨整年及闰日仍按日历边界计算', () => {
    expect(compensationYears('2020-01-01', '2020-12-31')).toBe(1)
    expect(compensationYears('2024-02-29', '2025-02-27')).toBe(1)
  })
  it('拒绝倒置日期', () => expect(() => compensationYears('2026-08-01', '2026-07-01')).toThrow())
})

describe('解除/终止类型与金额', () => {
  it('公司提出协商解除为N', () => {
    const result = calculate(example)
    expect(result.type).toBe('N')
    expect(result.compensationYears).toBe(6.5)
    expect(result.total).toBe(195000)
  })
  it('第40条未书面提前通知为N+1，两个工资口径分开', () => {
    const result = calculate({ ...example, reason: 'medical', notice: 'no', previousMonthSalary: 32000 })
    expect(result.type).toBe('N+1')
    expect(result.nAmount).toBe(195000)
    expect(result.noticeAmount).toBe(32000)
    expect(result.total).toBe(227000)
  })
  it('违法解除不继续履行为2N，不重复叠加N', () => {
    const result = calculate({ ...example, reason: 'illegal' })
    expect(result.type).toBe('2N')
    expect(result.total).toBe(390000)
  })
  it('要求继续履行时不误报0元', () => {
    const result = calculate({ ...example, reason: 'illegal', continueContract: 'yes' })
    expect(result.type).toBe('继续履行待判断')
    expect(result.total).toBeNull()
  })
  it('合法严重违纪等通常为0', () => {
    expect(calculate({ ...example, reason: 'misconduct' }).total).toBe(0)
    expect(calculate({ ...example, reason: 'expireEmployee' }).type).toBe('通常为0')
  })
  it('高工资触发三倍封顶及12年上限，但代通知金不封顶', () => {
    const result = calculate({ ...example, startDate: '2009-01-01', endDate: '2026-12-31', salaryTotal: 600000, reason: 'change', notice: 'no', previousMonthSalary: 60000 })
    expect(result.base).toBe(37731)
    expect(result.compensationYears).toBe(12)
    expect(result.nAmount).toBe(452772)
    expect(result.total).toBe(512772)
  })
  it('月均低于最低工资时按暂设最低工资托底', () => {
    expect(calculate({ ...example, salaryTotal: 12000 }).base).toBe(2740)
  })
  it('2008年前工龄不自动纳入，明确仅计其后', () => {
    const result = calculate({ ...example, startDate: '2000-01-01', endDate: '2010-12-31' })
    expect(result.pre2008).toBe(true)
    expect(result.effectiveStartDate).toBe('2008-01-01')
    expect(result.compensationYears).toBe(3)
  })
  it('工作不足12个月可按实际工资月数求均值', () => {
    const result = calculate({ ...example, startDate: '2026-01-01', endDate: '2026-06-30', salaryTotal: 60000, salaryMonths: 6 })
    expect(result.averageSalary).toBe(10000)
    expect(result.total).toBe(10000)
  })
  it('拒绝缺失的代通知金工资', () => {
    expect(() => calculate({ ...example, reason: 'medical', notice: 'no' })).toThrow('解除前一个月工资')
  })
})
