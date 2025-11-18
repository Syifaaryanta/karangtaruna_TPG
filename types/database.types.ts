export interface Member {
  id: string
  created_at: string
  name: string
  is_active: boolean
  balance_cash?: number
  balance_bank?: number
}

export interface Profile {
  id: string
  created_at: string
  email: string
  full_name: string
  role: 'bendahara' | 'member'
}

export interface MonthlyPayment {
  id: string
  created_at: string
  member_id: string
  month: number
  year: number
  amount: number
  paid: boolean
  paid_at: string | null
}

export interface Transaction {
  id: string
  created_at: string
  date: string
  type: 'income' | 'expense'
  amount: number
  description: string
  created_by: string | null
  payment_method?: 'cash' | 'transfer' | null
}

export interface Meeting {
  id: string
  created_at: string
  date: string
  topic: string
  location?: string | null
  total_cash_collected: number
  notes: string | null
}
