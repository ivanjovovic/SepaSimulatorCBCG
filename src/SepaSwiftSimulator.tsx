import React, { useEffect, useMemo, useState } from 'react'
import { getAllBanks, type BankProfile } from './bankLoader'
import { calcSwiftFeeDynamic, type SwiftBankProfile, type SwiftFeeResult } from './swiftFeeCalculator'

const SEPA_STANDARD_FEE_CAP = 20_000

function calcSepaFee(amount: number, channel: 'e-bankarstvo' | 'šalter', firstOfDay: boolean) {
  if (firstOfDay && amount <= 200) return 0.02
  if (channel === 'e-bankarstvo') return amount <= 20_000 ? 1.99 : 25
  return amount <= 20_000 ? 3.99 : 50
}
function formatEUR(n: number) {
  return new Intl.NumberFormat('me-ME', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(n)
}
function toAccCountry(country: string) {
  const s = (country || '').trim()
  if (s.length < 2) return s
  return s.slice(0, -1) + 'u'
}

export default function SepaSwiftSimulator() {
  const [country, setCountry] = useState('Njemačka')
  const [amountStr, setAmountStr] = useState('250')
  const amount = useMemo(() => {
    if (amountStr.trim()==='') return 0
    const normalized = amountStr.replace(',', '.').replace(/^0+(?=\d)/, '')
    const n = Number(normalized)
    return Number.isFinite(n) ? n : 0
  }, [amountStr])

  const [channel, setChannel] = useState<'e-bankarstvo'|'šalter'>('e-bankarstvo')
  const [firstOfDay, setFirstOfDay] = useState(true)
  const [clientType, setClientType] = useState<'fizicka'|'pravna'>('fizicka')
  const [isResident, setIsResident] = useState(true)

  const [bankProfiles, setBankProfiles] = useState<BankProfile[]>([])
  const [bankName, setBankName] = useState('')

  const [swiftSpecial, setSwiftSpecial] = useState('Standard')
  const [showInfo, setShowInfo] = useState(false)

  useEffect(() => {
    const banks = getAllBanks(clientType)
    setBankProfiles(banks)
    if (!banks.length) setBankName('')
    else if (!banks.find(b => b.name===bankName)) setBankName(banks[0].name)
  }, [clientType])

  useEffect(() => {
    const selected = bankProfiles.find(b => b.name===bankName)
    if (!selected) return
    const profile: SwiftBankProfile = {
      name: selected.name,
      transferOut: ((selected as any)[isResident ? 'resident':'non-resident'])?.transferOut ?? selected.transferOut,
    }
    const specials = Object.keys(profile.transferOut?.special || {})
    const hasAll = ['T+0','T+1','T+2'].every(k => specials.includes(k))
    setSwiftSpecial(hasAll ? 'T+2' : 'Standard')
  }, [bankName, isResident, bankProfiles])

  const sepaFee = useMemo(() => calcSepaFee(amount, channel, firstOfDay), [amount, channel, firstOfDay])

  const swiftShaResult = useMemo<SwiftFeeResult|null>(() => {
    const selected = bankProfiles.find(b => b.name===bankName)
    if (!selected) return null
    const profile: SwiftBankProfile = {
      name: selected.name,
      transferOut: ((selected as any)[isResident ? 'resident':'non-resident'])?.transferOut ?? selected.transferOut,
    }
    const settlementSpeed = profile.transferOut?.special && swiftSpecial!=='Standard' ? (swiftSpecial as any) : null
    return calcSwiftFeeDynamic({ amount, bankProfile: profile, swiftOption:'SHA', settlementSpeed })
  }, [amount, bankProfiles, bankName, isResident, swiftSpecial])

  const swiftOurResult = useMemo<SwiftFeeResult|null>(() => {
    const selected = bankProfiles.find(b => b.name===bankName)
    if (!selected) return null
    const profile: SwiftBankProfile = {
      name: selected.name,
      transferOut: ((selected as any)[isResident ? 'resident':'non-resident'])?.transferOut ?? selected.transferOut,
    }
    return calcSwiftFeeDynamic({ amount, bankProfile: profile, swiftOption:'OUR', settlementSpeed:null })
  }, [amount, bankProfiles, bankName, isResident])

  const swiftBenResult = useMemo<SwiftFeeResult|null>(() => {
    const selected = bankProfiles.find(b => b.name===bankName)
    if (!selected) return null
    const profile: SwiftBankProfile = {
      name: selected.name,
      transferOut: ((selected as any)[isResident ? 'resident':'non-resident'])?.transferOut ?? selected.transferOut,
    }
    return calcSwiftFeeDynamic({ amount, bankProfile: profile, swiftOption:'BEN', settlementSpeed:null })
  }, [amount, bankProfiles, bankName, isResident])

  const countryAcc = useMemo(() => toAccCountry(country), [country])

  const shaSettlementOptions = useMemo(() => {
    const selected = bankProfiles.find(b => b.name===bankName)
    if (!selected) return []
    const profile: SwiftBankProfile = {
      name: selected.name,
      transferOut: ((selected as any)[isResident ? 'resident':'non-resident'])?.transferOut ?? selected.transferOut,
    }
    const specials = Object.keys(profile.transferOut?.special || {})
    const ordered = ['T+0','T+1','T+2'].filter(k => specials.includes(k))
    const custom = specials.filter(k => !['T+0','T+1','T+2'].includes(k))
    if (!ordered.length && !custom.length) return []
    return ordered.length===3 ? [...ordered, ...custom] : ['Standard', ...ordered, ...custom]
  }, [bankProfiles, bankName, isResident])

  return (
    <div className="bg-blob min-h-screen w-full px-6 py-10 relative z-10">
      <div className="max-w-7xl mx-auto">
        <Header />

        <div className="grid lg:grid-cols-2 gap-7 mt-7">
          {/* Lijevi panel */}
          <div className="card card--halo p-6 glow">
           

            <div className="space-y-5">
              <Field label="Tip klijenta">
                <div className="seg">
                  <button aria-pressed={clientType==='fizicka'} onClick={()=>setClientType('fizicka')}>Fizička lica</button>
                  <button aria-pressed={clientType==='pravna'} onClick={()=>setClientType('pravna')}>Pravna lica</button>
                </div>
              </Field>

              <Field label="Status klijenta (za banku)">
                <div className="seg">
                  <button aria-pressed={isResident} onClick={()=>setIsResident(true)}>Rezident</button>
                  <button aria-pressed={!isResident} onClick={()=>setIsResident(false)}>Nerezident</button>
                </div>
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Field label="Iznos za slanje">
                  <div className="input money flex items-center gap-2">
                    <span className="text-[color:var(--primary)]">€</span>
                    <input
                      type="text" inputMode="decimal" placeholder="0" value={amountStr}
                      onChange={(e)=>{ const raw=e.target.value; setAmountStr(raw.replace(/[^\d.,]/g,'')) }}
                      onBlur={(e)=>{ const n=e.target.value.replace(',', '.').replace(/^0+(?=\d)/,''); setAmountStr(n) }}
                      className="w-full bg-transparent outline-none placeholder-slate-400"
                    />
                  </div>
                </Field>

                <Field label="Destinacija (SEPA zemlja)">
                  <div className="select-wrap">
                    <select value={country} onChange={(e)=>setCountry(e.target.value)} className="select">
                      {['Njemačka','Italija','Francuska','Španija','Hrvatska','Slovenija','Austrija','Holandija','Švedska','Irska'].map(o=>(
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                    <span className="chev">▾</span>
                  </div>
                </Field>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Field label="Kanal SEPA plaćanja">
                  <div className="seg">
                    <button aria-pressed={channel==='e-bankarstvo'} onClick={()=>setChannel('e-bankarstvo')}>e-bankarstvo</button>
                    <button aria-pressed={channel==='šalter'} onClick={()=>setChannel('šalter')}>šalter</button>
                  </div>
                </Field>

                <Field label="Prvi dnevni transfer do 200€?">
                  <button className="toggle" data-on={firstOfDay} onClick={()=>setFirstOfDay(v=>!v)}>
                    <span className="toggle-dot" />
                  </button>
                </Field>
              </div>

              <Field label={
                <span className="inline-flex items-center gap-2">
                  Vaša banka
                  <button
                    type="button" onClick={()=>setShowInfo(true)}
                    className="text-xs px-2 py-1 rounded-md border border-[color:var(--border)] hover:bg-[#f0f6ff] transition"
                    title="Prikaži informativne OUR/BEN proračune"
                  >i</button>
                </span>
              }>
                <div className="select-wrap">
                  <select value={bankName} onChange={(e)=>setBankName(e.target.value)} className="select">
                    {bankProfiles.map(b=>(<option key={b.name} value={b.name}>{b.name}</option>))}
                  </select>
                  <span className="chev">▾</span>
                </div>
              </Field>

              {shaSettlementOptions.length>0 && (
                <Field label="Poravnanje (SHA)">
                  <div className="seg">
                    {shaSettlementOptions.map(opt=>(
                      <button key={opt} aria-pressed={swiftSpecial===opt} onClick={()=>setSwiftSpecial(opt)}>{opt}</button>
                    ))}
                  </div>
                </Field>
              )}

              <div className="rounded-md border border-amber-300/50 bg-amber-50 text-amber-800 p-3 text-sm">
                Za precizne informacije obratite se banci.
              </div>
            </div>
          </div>

          {/* Desni panel — VEĆI I ISTAKNUT */}
          <div className="card card--halo p-6 lg:p-8">
            <CostOverview
              amount={amount}
              countryAcc={countryAcc}
              sepaFee={sepaFee}
              swiftShaResult={swiftShaResult}
            />
          </div>
        </div>

        <div className="mt-6 text-xs subtle">
          * Ovo je edukativni prikaz. Za precizne informacije obratite se banci.
        </div>
      </div>

      {showInfo && (
        <InfoModal onClose={()=>setShowInfo(false)}>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold" style={{color:'var(--primary)'}}>Informativne opcije troškova</h3>
            <p className="text-sm subtle">
              SEPA koristi <b>SHA</b>. Ispod su informativni proračuni (ako postoje pravila u banci):
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              <InfoCard title="OUR (informativno)" result={swiftOurResult} />
              <InfoCard title="BEN (informativno)" result={swiftBenResult} />
            </div>
            <p className="text-xs subtle">* Informativno – kontaktirajte banku za precizne uslove.</p>
          </div>
        </InfoModal>
      )}
    </div>
  )
}

/* ---------- UI helpers ---------- */

function Header(){
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-4xl h1-grad">Pregled troškova plaćanja</h1>
        <div className="mt-3 tabs">
          <span className="tab active">SWIFT (SHA)</span>
          <span className="tab">SEPA</span>
        </div>
        <p className="mt-2 subtle">Uporedi indikativne troškove.</p>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }){
  return (
    <label className="block">
      <div className="mb-1 text-sm subtle">{label}</div>
      {children}
    </label>
  )
}

/* --- NOVI, ISTAKNUTI Pregled troškova --- */
function CostOverview({
  amount, countryAcc, sepaFee, swiftShaResult,
}:{
  amount:number; countryAcc:string; sepaFee:number; swiftShaResult:SwiftFeeResult|null
}){
  const swift = swiftShaResult || { senderFee:0, senderPaysTotal:amount }

  return (
    <div className="h-full flex flex-col">
      <h4 className="text-xl md:text-2xl font-semibold mb-5" style={{color:'var(--primary)'}}>
        Pregled troškova
      </h4>

      <div className="flex flex-col gap-6 grow">
        {/* SWIFT (SHA) */}
        <div className="card p-6">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-semibold subtle">SWIFT (SHA)</div>
            <span className="badge-soft">SHA</span>
          </div>

          <div className="kv">
            <div className="lab">Šalješ</div>
            <div className="val big">{`${formatEUR(amount)} → ${countryAcc}`}</div>

            <div className="lab">Naknada (pošiljalac)</div>
            <div className="val">{formatEUR(swift.senderFee)}</div>
          </div>

          <div className="total-line">
            <div className="lab">Pošiljalac plaća ukupno</div>
            <div className="total-amount">{formatEUR(swift.senderPaysTotal)}</div>
          </div>
        </div>

        {/* SEPA */}
        <div className="card p-6">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-semibold subtle">SEPA</div>
            <span className="badge-soft">SCT</span>
          </div>

          <div className="kv">
            <div className="lab">Šalješ</div>
            <div className="val big">{`${formatEUR(amount)} → ${countryAcc}`}</div>

            <div className="lab">SEPA naknada (indikativno)</div>
            <div className="val">{formatEUR(sepaFee)}</div>
          </div>

          <div className="total-line">
            <div className="lab">Pošiljalac plaća ukupno</div>
            <div className="total-amount">{formatEUR(amount + sepaFee)}</div>
          </div>

          <p className="text-[11px] subtle mt-2">
            * Tipične naknade: e-bankarstvo do {formatEUR(SEPA_STANDARD_FEE_CAP)} ≈ 1.99€; šalter veće.
          </p>
        </div>
      </div>
    </div>
  )
}



function StatRow({ label, value, big=false }:{
  label:string; value:string; big?:boolean
}){
  return (
    <div className="flex items-end justify-between py-1.5">
      <span className={"subtle " + (big ? "text-sm md:text-base" : "text-sm")}>{label}</span>
      <span className={"font-extrabold money " + (big ? "text-xl md:text-2xl" : "text-base md:text-lg")}>
        {value}
      </span>
    </div>
  )
}

function InfoModal({ children, onClose }:{ children:React.ReactNode; onClose:()=>void }){
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/45" onClick={onClose} />
      <div className="relative w-full max-w-2xl card p-6">
        <button onClick={onClose} className="absolute right-3 top-3 subtle hover:text-[color:var(--primary)]" aria-label="Zatvori">✕</button>
        {children}
      </div>
    </div>
  )
}

function InfoCard({ title, result }:{ title:string; result:SwiftFeeResult|null }){
  return (
    <div className="card p-4">
      <div className="text-sm font-semibold mb-2 subtle">{title}</div>
      {result ? (
        <>
          <StatRow label="Naknada (pošiljalac)" value={formatEUR(result.senderFee)} />
          <StatRow label="Pošiljalac plaća ukupno" value={formatEUR(result.senderPaysTotal)} />
        </>
      ) : (
        <div className="text-sm subtle">Nema definisanih pravila.</div>
      )}
    </div>
  )
}
