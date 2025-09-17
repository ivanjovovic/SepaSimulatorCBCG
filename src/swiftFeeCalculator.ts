// swiftFeeCalculator.ts

export type SwiftFeeRule = {
  maxAmount?: number
  minAmount?: number
  feeType?: string
  feeValue?: number
  minFee?: number
  maxFee?: number
  additionalFee?: number
  settlement?: 'T+0' | 'T+1' | 'T+2' | string | null
}

export type SwiftFeeResult = {
  senderFee: number
  senderPaysTotal: number
}

// ⬇️ TransferOut sada eksplicitno podržava "special" (mapa settlement -> dodatak u €)
export type TransferOutOption =
  (Record<string, SwiftFeeRule[] | { notice?: string }>) & {
    special?: Record<string, number>
  }

export type SwiftBankProfile = {
  name: string
  transferOut?: TransferOutOption
  resident?: { transferOut?: TransferOutOption }
  'non-resident'?: { transferOut?: TransferOutOption }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function calculate({
  amount,
  fee,
  feeType,
  minFee,
  additionalFee
}: { amount: number, feeType: string, minFee: number, additionalFee: number | null, fee: number }): number {
  let sndrFee = 0
  if (feeType === 'percentage') {
    sndrFee = amount * fee
  } else if (feeType === 'fixed') {
    sndrFee = fee
  } else {
    if (additionalFee) sndrFee = amount * fee + additionalFee
  }
  if (sndrFee < minFee) sndrFee = minFee
  return sndrFee
}

export function specialCalculation({
  amount,
  bankProfile
}: { amount: number, bankProfile: SwiftBankProfile }): SwiftFeeResult | null {

  const sha_rules = bankProfile.transferOut?.['SHA']
  const our_rules = bankProfile.transferOut?.['OUR']

  const sha = sha_rules as SwiftFeeRule[] | undefined
  const our = our_rules as SwiftFeeRule[] | undefined

  const sha_rule = sha?.find(r =>
    typeof r.minAmount === 'number' &&
    (typeof r.maxAmount === 'number' || r.maxAmount === null) &&
    amount > r.minAmount &&
    amount <= (r.maxAmount ?? Infinity)
  )

  const our_rule = our?.find(r =>
    typeof r.minAmount === 'number' &&
    (typeof r.maxAmount === 'number' || r.maxAmount === null) &&
    amount > r.minAmount &&
    amount <= (r.maxAmount ?? Infinity)
  )

  let shaFee = 0
  let ourFee = 0
  let senderFee = 0

  if (sha_rule && our_rule) {
    shaFee = calculate({
      amount,
      fee: sha_rule.feeValue ?? 0,
      feeType: sha_rule.feeType ?? 'percentage',
      minFee: sha_rule.minFee ?? 0,
      additionalFee: sha_rule.additionalFee ?? 0
    })
    ourFee = calculate({
      amount,
      fee: our_rule.feeValue ?? 0,
      feeType: our_rule.feeType ?? 'percentage',
      minFee: our_rule.minFee ?? 0,
      additionalFee: our_rule.additionalFee ?? 0
    })
    senderFee = shaFee + ourFee
  }

  const senderPaysTotal = amount + senderFee
  return { senderFee, senderPaysTotal }
}

export function calcSwiftFeeDynamic({
  amount,
  bankProfile,
  swiftOption,
  settlementSpeed,
}: {
  amount: number
  bankProfile: SwiftBankProfile
  swiftOption: string
  // settlementSpeed je *opciono* (može biti undefined ili null)
  settlementSpeed?: string | null
}): SwiftFeeResult | null {
  const rulesRaw = bankProfile.transferOut?.[swiftOption]
  if (bankProfile.name === 'Universal Capital Bank AD' && swiftOption === 'OUR') {
    const senderFee = specialCalculation({ amount, bankProfile })
    return senderFee
  }

  if (!Array.isArray(rulesRaw)) return null // Nema definisanih pravila za ovu opciju

  const rules = rulesRaw as SwiftFeeRule[]
  const hasSettlementInRules = rules.some(r => typeof r.settlement === 'string')
  let rule: SwiftFeeRule | undefined

  const inRange = (r: SwiftFeeRule) => {
    const minOk = typeof r.minAmount === 'number' ? amount >= r.minAmount! : true
    const maxOk = typeof r.maxAmount === 'number' ? amount <= r.maxAmount! : true
    return minOk && maxOk
  }

  // 1) Ako pravila eksplicitno imaju settlement i korisnik je odabrao settlement → precizno pravilo
  if (hasSettlementInRules && settlementSpeed) {
    rule = rules.find(r => r.settlement === settlementSpeed && inRange(r))
  }

  // 2) Fallback: standardni raspon (bez settlement-a)
  if (!rule) {
    rule = rules.find(r =>
      typeof r.minAmount === 'number' &&
      (typeof r.maxAmount === 'number' || r.maxAmount === null) &&
      amount >= r.minAmount! &&
      amount <= (r.maxAmount ?? Infinity)
    )
  }

  if (!rule) return null // i dalje nema pravila

  // 3) Obračun osnovne naknade po pravilu
  let senderFee = 0
  if (typeof rule.feeValue === 'number' && typeof rule.additionalFee === 'number') {
    if (rule.feeType === 'fixed') {
      senderFee = rule.feeValue + rule.additionalFee
    } else if (rule.feeType === 'percentage') {
      senderFee = (amount * rule.feeValue) + rule.additionalFee
    } else {
      senderFee = (amount * rule.feeValue) + rule.additionalFee
    }

    if (typeof rule.maxFee === 'number' && typeof rule.minFee === 'number') {
      if (rule.maxFee > 0 && senderFee > rule.maxFee) senderFee = rule.maxFee
      else if (senderFee < rule.minFee) senderFee = rule.minFee
    }
  }

  // 4) ⬅️ KLJUČNO: Ako pravila *nemaju* settlement, ali postoji transferOut.special i korisnik je odabrao settlement,
  //    dodaj “special” doplatu (Hipotekarna/Lovćen itd.)
  const specials = bankProfile.transferOut?.special
  if (!hasSettlementInRules && settlementSpeed && specials && typeof specials[settlementSpeed] === 'number') {
    senderFee += specials[settlementSpeed]!
  }

  senderFee = round2(senderFee)
  const senderPaysTotal = round2(amount + senderFee)
  return { senderFee, senderPaysTotal }
}
