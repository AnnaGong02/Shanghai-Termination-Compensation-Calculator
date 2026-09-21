import { useState } from 'react'
import { calculate, compensationYears, type CalculatorInput, type CalculationResult, type Reason } from './lib/calculate'
import { shanghaiParameters } from './config/shanghai'

const reasons: { value: Reason; label: string }[] = [
  { value: 'agreement', label: '公司提出，与员工协商一致解除' },
  { value: 'medical', label: '医疗期满后解除' },
  { value: 'incompetent', label: '不能胜任工作，经培训或调岗后仍不能胜任而解除' },
  { value: 'change', label: '客观情况发生重大变化，协商变更未果而解除' },
  { value: 'layoff', label: '经济性裁员' },
  { value: 'expireEmployer', label: '劳动合同到期，公司不再续签' },
  { value: 'expireEmployee', label: '公司维持或提高续签条件，员工不同意续签' },
  { value: 'employeeQuit', label: '员工主动辞职（不涉及公司违法情形）' },
  { value: 'misconduct', label: '严重违纪等依法解除' },
  { value: 'illegal', label: '公司违法解除 / 违法终止' },
]

const initialInput: CalculatorInput = {
  startDate: '', endDate: '', reason: 'agreement', notice: 'yes', continueContract: 'no',
  salaryTotal: Number.NaN, salaryMonths: 12, previousMonthSalary: null,
}

const money = (value: number) => new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', minimumFractionDigits: 2 }).format(value)
const noticeReasons: Reason[] = ['medical', 'incompetent', 'change']
const isZero = (reason: Reason) => ['expireEmployee', 'employeeQuit', 'misconduct'].includes(reason)

function Progress({ step }: { step: number }) {
  return <div className="progress" aria-label={`第 ${step} 步，共 4 步`}>
    <span>{step}/4</span>
    <div className="progress-track">{[1, 2, 3, 4].map(n => <i key={n} className={n <= step ? 'on' : ''} />)}</div>
  </div>
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className={`row ${strong ? 'strong' : ''}`}><span>{label}</span><span>{value}</span></div>
}

export default function App() {
  const [step, setStep] = useState(1)
  const [input, setInput] = useState<CalculatorInput>(initialInput)
  const [result, setResult] = useState<CalculationResult | null>(null)
  const [error, setError] = useState('')
  const [showLaw, setShowLaw] = useState(false)
  const needsNotice = noticeReasons.includes(input.reason)
  const needsPreviousMonth = needsNotice && input.notice === 'no'
  const tenure = input.startDate && input.endDate ? (() => { try { return compensationYears(input.startDate, input.endDate) } catch { return null } })() : null

  const update = <K extends keyof CalculatorInput>(key: K, value: CalculatorInput[K]) => {
    setInput(previous => ({ ...previous, [key]: value }))
    setError('')
  }
  const advance = () => {
    if (step === 1) {
      if (!input.startDate || !input.endDate) { setError('请填写入职日期和解除/终止日期。'); return }
      try { compensationYears(input.startDate, input.endDate) } catch (cause) { setError(cause instanceof Error ? cause.message : '请检查日期。'); return }
      if (input.startDate < '2008-01-01' && input.endDate < '2008-01-01') { setError('解除日期早于2008年，本版不计算该期间。'); return }
    }
    setStep(current => current + 1)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }
  const goBack = () => { setError(''); setStep(current => current - 1); window.scrollTo({ top: 0, behavior: 'instant' }) }
  const onCalculate = () => {
    try {
      const next = calculate(input)
      setResult(next)
      setError('')
      setStep(4)
      window.scrollTo({ top: 0, behavior: 'instant' })
    } catch (cause) { setError(cause instanceof Error ? cause.message : '请检查输入信息。') }
  }
  const restart = () => { setInput(initialInput); setResult(null); setError(''); setStep(1); setShowLaw(false); window.scrollTo({ top: 0, behavior: 'instant' }) }

  return <div className="shell">
    <header className="topbar"><span className="topbar-mark" aria-hidden="true" />上海解除/终止补偿计算器</header>
    <main className="wrap">
      <div className="intro"><span className="kicker">上海 · 劳动用工工具</span><h1>解除/终止<br />补偿计算器</h1><p>选情形、填日期和工资，查看 N / N+1 / 2N 的初步估算与计算过程。</p></div>
      <Progress step={step} />
      {error && <div className="error" role="alert">{error}</div>}

      {step === 1 && <section aria-labelledby="step-one"><h2 id="step-one">01 <span>基本信息</span></h2><p className="desc">先确定在本单位工作的起止时间。</p>
        <div className="field"><label htmlFor="start">入职日期</label><input id="start" type="date" value={input.startDate} onChange={event => update('startDate', event.target.value)} required /></div>
        <div className="field"><label htmlFor="end">解除/终止日期</label><input id="end" type="date" value={input.endDate} onChange={event => update('endDate', event.target.value)} required /></div>
        {tenure !== null && <div className="info">按所填日期折算的完整工龄对应 <b>{tenure} 个月工资</b>。解除当日计入期间。</div>}
        {input.startDate && input.startDate < '2008-01-01' && <div className="warn">2008年1月1日前入职，可能涉及分段计算。本版仅估算2008年起的部分，最终金额不含2008年前可能应付的部分。</div>}
        <button className="btn primary" onClick={advance}>下一步：选择离职情形 <span>→</span></button>
      </section>}

      {step === 2 && <section aria-labelledby="step-two"><h2 id="step-two">02 <span>离职情形</span></h2><p className="desc">选择与事实最接近的一项；合法性仍需单独判断。</p>
        <div className="radio-list">{reasons.map(reason => <label className={`option ${input.reason === reason.value ? 'sel' : ''}`} key={reason.value}><input type="radio" name="reason" checked={input.reason === reason.value} onChange={() => update('reason', reason.value)} /><span>{reason.label}</span></label>)}</div>
        {needsNotice && <fieldset className="subq"><legend>是否提前30日书面通知？</legend><label className="option"><input type="radio" name="notice" checked={input.notice === 'yes'} onChange={() => update('notice', 'yes')} /><span>是，已提前30日书面通知</span></label><label className="option"><input type="radio" name="notice" checked={input.notice === 'no'} onChange={() => update('notice', 'no')} /><span>否，拟支付代通知金</span></label></fieldset>}
        {input.reason === 'illegal' && <fieldset className="subq"><legend>员工是否要求继续履行合同？</legend><label className="option"><input type="radio" name="continue" checked={input.continueContract === 'no'} onChange={() => update('continueContract', 'no')} /><span>不要求 / 已无法继续履行</span></label><label className="option"><input type="radio" name="continue" checked={input.continueContract === 'yes'} onChange={() => update('continueContract', 'yes')} /><span>要求继续履行</span></label></fieldset>}
        <div className="info">初步类型：<b>{input.reason === 'illegal' ? input.continueContract === 'yes' ? '继续履行待判断' : '2N' : needsNotice ? input.notice === 'no' ? 'N+1' : 'N' : isZero(input.reason) ? '通常为0' : 'N'}</b></div>
        <div className="actions"><button className="btn ghost" onClick={goBack}>上一步</button><button className="btn primary" onClick={advance}>下一步</button></div>
      </section>}

      {step === 3 && <section aria-labelledby="step-three"><h2 id="step-three">03 <span>工资信息</span></h2><p className="desc">N 和代通知金使用不同的工资口径，请分别填写。</p>
        <div className="field"><label htmlFor="salaryTotal">解除/终止前工资合计（应得工资，元）</label><input id="salaryTotal" type="number" inputMode="decimal" min="0" step="0.01" value={Number.isFinite(input.salaryTotal) ? input.salaryTotal : ''} placeholder="例如 360000" onChange={event => update('salaryTotal', event.target.value === '' ? Number.NaN : Number(event.target.value))} /><small>包括奖金、津贴、补贴等货币性收入；请按实际应得金额填写。</small></div>
        <div className="field"><label htmlFor="salaryMonths">上述工资对应月数</label><input id="salaryMonths" type="number" inputMode="numeric" min="1" max="12" step="1" value={input.salaryMonths} onChange={event => update('salaryMonths', Number(event.target.value))} /><small>通常为12个月；工作不满12个月时填实际工作月数。</small></div>
        {Number.isFinite(input.salaryTotal) && input.salaryMonths > 0 && <div className="info">N的月工资原始均值：<b>{money(input.salaryTotal / input.salaryMonths)}</b></div>}
        {needsPreviousMonth && <div className="field"><label htmlFor="previousMonthSalary">解除前一个月工资（代通知金“1”，元）</label><input id="previousMonthSalary" type="number" inputMode="decimal" min="0" step="0.01" value={input.previousMonthSalary ?? ''} placeholder="例如 32000" onChange={event => update('previousMonthSalary', event.target.value === '' ? null : Number(event.target.value))} /><small>“1”独立计算，不套用 N 的平均工资或三倍封顶。</small></div>}
        <div className="standards"><b>{shanghaiParameters.label}</b><Row label="月平均工资参考" value={money(shanghaiParameters.averageMonthlyWage)} /><Row label="N 的三倍封顶" value={money(shanghaiParameters.tripleCap)} /><Row label="月最低工资" value={money(shanghaiParameters.minimumMonthlyWage)} /></div>
        <div className="actions"><button className="btn ghost" onClick={goBack}>上一步</button><button className="btn primary" onClick={onCalculate}>计算结果</button></div>
      </section>}

      {step === 4 && result && <section aria-labelledby="step-four"><h2 id="step-four">04 <span>初步计算结果</span></h2>
        <div className={`resultbox ${result.type === '2N' ? 'redbox' : ''}`}><span className="result-pill">{result.type}</span><span className="result-caption">最终合计</span><strong className="money">{result.total === null ? '暂不计算' : money(result.total)}</strong></div>
        <div className="summary"><h3>金额拆解</h3><Row label="N 计算基数" value={`${money(result.base)} / 月`} /><Row label="补偿年限" value={`${result.compensationYears} 个月工资`} /><Row label="N 金额（计算中间值）" value={money(result.nAmount)} />{result.type === 'N+1' && <Row label="代通知金“1”" value={money(result.noticeAmount)} />}{result.type === '2N' && <Row label="2N 赔偿金（不另加 N）" value={money(result.doubleAmount)} />}<Row label="最终合计" value={result.total === null ? '待判断' : money(result.total)} strong /></div>
        <div className="info">{result.explanation}</div>
        {result.capped && <div className="warn">已触发三倍工资封顶：N 基数按 {money(shanghaiParameters.tripleCap)} 计算，补偿年限上限为12年。</div>}
        {result.minimumApplied && <div className="warn">原始月均工资低于暂设最低工资，N 基数已按 {money(shanghaiParameters.minimumMonthlyWage)} 计算。</div>}
        {result.pre2008 && <div className="warn"><b>不是最终应付总额：</b>仅计算自 {result.effectiveStartDate} 起的部分；2008年前的年限、当时适用规则及是否应付须另行核算。</div>}
        {(result.type === '通常为0' || result.type === '继续履行待判断') && <div className="warn">上方 N 仅作为计算参考，不属于本次应付项目。</div>}
        <div className="actions"><button className="btn ghost" onClick={goBack}>返回修改</button><button className="btn primary" onClick={restart}>重新计算</button></div>
        <button className="law-toggle" type="button" aria-expanded={showLaw} onClick={() => setShowLaw(value => !value)}>法律依据与计算说明 <span>{showLaw ? '−' : '＋'}</span></button>
        {showLaw && <div className="law-content"><p>《劳动合同法》第40条：无过失性解除的提前通知或额外支付一个月工资；第46条：经济补偿适用情形；第47条：补偿年限、工资基数及高工资封顶；第48、87条：违法解除或终止与继续履行、赔偿金。</p><p>《劳动合同法实施条例》第25条：2N赔偿金不与N重复支付；第27条：应得工资口径、低于最低工资的基数及工作不足12个月时的平均月份。</p><p>《劳动合同法》第97条：2008年前的工作年限可能需适用当时规定分段计算。本工具仅作初步金额估算，不判断解除事由、程序、年限合并、工资组成、医疗补助费等问题。</p><a href="https://rsj.sh.gov.cn/tgjfl_17254/20200617/t0035_1388217.html" target="_blank" rel="noreferrer">查看劳动合同法原文 ↗</a><a href="https://rsj.sh.gov.cn/tgwyxzfgwj_17255/20200617/t0035_1388240.html" target="_blank" rel="noreferrer">查看实施条例原文 ↗</a></div>}
      </section>}
      <footer>本工具仅供初步测算，不构成正式法律意见。上海年度参数为暂设值；作出实际解除决定或支付前，请核对当期官方标准并由专业人士复核。</footer>
    </main>
  </div>
}
