// src/bankLoader.ts
export type BankProfile = {
  name: string
  transferOut: Record<string, any>
}

// Učitajmo **oba** fajla eagerno (Vite bundluje oba), pa biramo po imenu fajla.
const modules = import.meta.glob("./banks/bank_profiles*.json", { eager: true })

// Ekstrahuj po tipu klijenta
type ClientType = "fizicka" | "pravna"

const datasets: Record<ClientType, BankProfile[]> = {
  fizicka: [],
  pravna: [],
}

// Razvrstaj prema nazivu fajla
Object.entries(modules).forEach(([path, mod]: any) => {
  const data: BankProfile[] = Array.isArray(mod.default) ? mod.default : []
  if (path.endsWith("bank_profiles_pravna.json")) {
    datasets.pravna = data
  } else {
    // podrazumijevano tretiramo kao fizička (pokriva i stari naziv bank_profiles.json)
    datasets.fizicka = data
  }
})

export function getAllBanks(client: ClientType = "fizicka"): BankProfile[] {
  return datasets[client] ?? []
}

export function getBankByName(name: string, client: ClientType = "fizicka"): BankProfile | undefined {
  return getAllBanks(client).find((b) => b.name === name)
}
