import { shanghaiParameters } from '../config/shanghai'

export type Reason = 'agreement' | 'medical' | 'incompetent' | 'change' | 'layoff' | 'expireEmployer' | 'expireEmployee' | 'employeeQuit' | 'misconduct' | 'illegal'
export type ResultType = 'N' | 'N+1' | '2N' | '通常为0' | '继续履行待判断'

export interface CalculatorInput {
  startDate: string
  endDate: string
  reason: Reason
  notice: 'yes' | 'no'
  continueContract: 'yes' | 'no'
  salaryTotal: number
  salaryMonths: number
  previousMonthSalary: number | null
}

export interface CalculationResult {
  type: ResultType
  averageSalary: number
  base: number
  compensationYears: number
  nAmount: number
  noticeAmount: number
  doubleAmount: number
  total: number | null
  capped: boolean
  minimumApplied: boolean
  pre2008: boolean
  effectiveStartDate: string
  explanation: string
}

const NOTICE_REASONS: Reason[] = ['medical', 'incompetent', 'change']
const N_REASONS: Reason[] = ['agreement', 'layoff', 'expireEmployer']
const ZERO_REASONS: Reason[] = ['expireEmployee', 'employeeQuit', 'misconduct']
const REFORM_START = '2008-01-01'

function parseDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('请填写有效的入职与解除日期。')
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw new Error('请填写有效的入职与解除日期。')
  return date
}

function addMonths(date: Date, months: number): Date {
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth() + months
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  return new Date(Date.UTC(year, month, Math.min(date.getUTCDate(), lastDay)))
}

/** 解除当日计入工作期间；不足6个月按半个月，满6个月不足1年按1个月。 */
export function compensationYears(startDate: string, endDate: string): number {
  const start = parseDate(startDate)
  const end = parseDate(endDate)
  if (end < start) throw new Error('解除日期不能早于入职日期。')
  const exclusiveEnd = new Date(end.getTime() + 86400000)
  let fullYears = exclusiveEnd.getUTCFullYear() - start.getUTCFullYear()
  while (addMonths(start, fullYears * 12) > exclusiveEnd) fullYears--
  const remainderStart = addMonths(start, fullYears * 12)
  if (remainderStart >= exclusiveEnd) return fullYears
  return fullYears + (addMonths(remainderStart, 6) <= exclusiveEnd ? 1 : 0.5)
}

const yuan = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

export function calculate(input: CalculatorInput): CalculationResult {
  const start = parseDate(input.startDate)
  const end = parseDate(input.endDate)
  if (end < start) throw new Error('解除日期不能早于入职日期。')
  if (!Number.isFinite(input.salaryTotal) || input.salaryTotal < 0) throw new Error('工资合计须为不小于 0 的数字。')
  if (!Number.isInteger(input.salaryMonths) || input.salaryMonths < 1 || input.salaryMonths > 12) throw new Error('工资月份须为 1 至 12 的整数。')
  const pre2008 = input.startDate < REFORM_START
  const effectiveStartDate = pre2008 ? REFORM_START : input.startDate
  if (input.endDate < REFORM_START) throw new Error('解除日期早于2008年，本版不计算该期间，请人工复核。')
  const years = compensationYears(effectiveStartDate, input.endDate)
  const averageSalary = input.salaryTotal / input.salaryMonths
  const capped = averageSalary > shanghaiParameters.tripleCap
  const minimumApplied = averageSalary < shanghaiParameters.minimumMonthlyWage
  const base = capped ? shanghaiParameters.tripleCap : Math.max(averageSalary, shanghaiParameters.minimumMonthlyWage)
  const compensation = capped ? Math.min(years, 12) : years
  const nAmount = yuan(base * compensation)

  let type: ResultType
  let noticeAmount = 0
  let doubleAmount = 0
  let total: number | null
  let explanation: string

  if (NOTICE_REASONS.includes(input.reason)) {
    if (input.notice === 'no') {
      if (input.previousMonthSalary === null || !Number.isFinite(input.previousMonthSalary) || input.previousMonthSalary < 0) throw new Error('请填写不小于 0 的解除前一个月工资。')
      type = 'N+1'
      noticeAmount = yuan(input.previousMonthSalary)
      total = yuan(nAmount + noticeAmount)
      explanation = 'N 按平均应得工资计算；代通知金“1”单独按解除前一个月工资计算。'
    } else {
      type = 'N'
      total = nAmount
      explanation = '已选择提前30日书面通知；在解除条件与程序成立的前提下，按 N 估算。'
    }
  } else if (N_REASONS.includes(input.reason)) {
    type = 'N'
    total = nAmount
    explanation = '在所选解除或终止条件及程序成立的前提下，按经济补偿 N 估算。'
  } else if (ZERO_REASONS.includes(input.reason)) {
    type = '通常为0'
    total = 0
    explanation = '以所选事实及合法程序成立为前提；若实际情况不同，可能仍须支付补偿或赔偿。'
  } else if (input.reason === 'illegal' && input.continueContract === 'yes') {
    type = '继续履行待判断'
    total = null
    explanation = '员工要求且合同能够继续履行时，应先判断继续履行，不宜直接按 2N 给出零元结论。'
  } else {
    type = '2N'
    doubleAmount = yuan(nAmount * 2)
    total = doubleAmount
    explanation = '2N 是违法解除/终止赔偿金，不与 N 经济补偿重复相加。'
  }

  return { type, averageSalary: yuan(averageSalary), base: yuan(base), compensationYears: compensation, nAmount, noticeAmount, doubleAmount, total, capped, minimumApplied, pre2008, effectiveStartDate, explanation }
}
