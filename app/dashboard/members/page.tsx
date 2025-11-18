'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Member, Profile } from '@/types/database.types'
import { UserPlus, Check, Loader2, Trash2, Wallet, CreditCard, Edit2, Calendar, X, Users } from 'lucide-react'

interface PaymentRecord {
  paid: boolean
  method?: 'cash' | 'transfer'
}

interface PaymentMap {
  [memberId: string]: {
    [monthYear: string]: PaymentRecord
  }
}

export default function MembersPage() {
  const supabase = createClient()
  const [members, setMembers] = useState<Member[]>([])
  const [payments, setPayments] = useState<PaymentMap>({})
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newMemberName, setNewMemberName] = useState('')
  const [addingMember, setAddingMember] = useState(false)
  
  // Saldo states
  const [cashBalance, setCashBalance] = useState(0)
  const [bankBalance, setBankBalance] = useState(0)
  const [editingCash, setEditingCash] = useState(false)
  const [editingBank, setEditingBank] = useState(false)
  const [tempCash, setTempCash] = useState('0')
  const [tempBank, setTempBank] = useState('0')
  
  // Payment method modal
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState<{memberId: string, month: number, year: number} | null>(null)
  
  // Month range states
  const [showRangeModal, setShowRangeModal] = useState(false)
  const [startMonth, setStartMonth] = useState(7) // Juli
  const [startYear, setStartYear] = useState(2025)
  const [endMonth, setEndMonth] = useState(11) // November
  const [endYear, setEndYear] = useState(2025)

  // Generate months based on range
  const getMonthsInRange = () => {
    const months = []
    let currentDate = new Date(startYear, startMonth - 1, 1)
    const endDate = new Date(endYear, endMonth - 1, 1)
    
    while (currentDate <= endDate) {
      months.push({
        month: currentDate.getMonth() + 1,
        year: currentDate.getFullYear(),
        label: currentDate.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' })
      })
      currentDate.setMonth(currentDate.getMonth() + 1)
    }
    
    return months
  }

  const months = getMonthsInRange()

  useEffect(() => {
    fetchData()
  }, [startMonth, startYear, endMonth, endYear])

  const fetchData = async () => {
    setLoading(true)
    
    // Get user profile
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      setProfile(profileData)
    }

    // Get members - sorted alphabetically
    const { data: membersData } = await supabase
      .from('members')
      .select('*')
      .eq('is_active', true)
      .order('name')

    if (membersData) {
      setMembers(membersData)

      // Get all payments for these members
      const { data: paymentsData } = await supabase
        .from('monthly_payments')
        .select('*')
        .in('member_id', membersData.map(m => m.id))

      // Create payment map
      const paymentMap: PaymentMap = {}
      
      membersData.forEach(member => {
        paymentMap[member.id] = {}
        months.forEach(({ month, year }) => {
          const key = `${month}-${year}`
          const payment = paymentsData?.find(
            p => p.member_id === member.id && p.month === month && p.year === year
          )
          if (payment) {
            paymentMap[member.id][key] = {
              paid: payment.paid || false,
              method: (payment as any).payment_method || undefined
            }
          } else {
            paymentMap[member.id][key] = { paid: false }
          }
        })
      })
      
      setPayments(paymentMap)
      
      // Get saldo from first member by name order (organization balance)
      if (membersData.length > 0) {
        // membersData already sorted by name from query
        const orgMember = membersData[0]
        console.log('Fetching balance from first member:', orgMember.name, orgMember.id)
        console.log('Balance from DB:', { 
          cash: orgMember.balance_cash, 
          bank: orgMember.balance_bank 
        })
        setCashBalance(orgMember.balance_cash || 0)
        setBankBalance(orgMember.balance_bank || 0)
      }
    }

    setLoading(false)
  }

  const openPaymentModal = (memberId: string, month: number, year: number) => {
    const key = `${month}-${year}`
    const currentStatus = payments[memberId]?.[key]?.paid || false
    
    if (currentStatus) {
      // If already paid, unpay it
      handlePayment(memberId, month, year, null)
    } else {
      // Show modal to choose payment method
      setSelectedPayment({ memberId, month, year })
      setShowPaymentModal(true)
    }
  }

  const handlePayment = async (memberId: string, month: number, year: number, method: 'cash' | 'transfer' | null) => {
    if (profile?.role !== 'bendahara') return

    const key = `${month}-${year}`
    const currentStatus = payments[memberId]?.[key]?.paid || false

    console.log('handlePayment called:', { memberId, month, year, method, currentStatus })

    try {
      if (currentStatus || method === null) {
        // Read existing payment from DB so we know method/amount to reverse
        const { data: existingPayment, error: paymentFetchError } = await supabase
          .from('monthly_payments')
          .select('payment_method, amount')
          .eq('member_id', memberId)
          .eq('month', month)
          .eq('year', year)
          .single()

        if (paymentFetchError && paymentFetchError.code !== 'PGRST116') {
          console.error('Error fetching existing payment before delete:', paymentFetchError)
        }

        const oldMethod = (existingPayment as any)?.payment_method || payments[memberId]?.[key]?.method
        const oldAmount = (existingPayment as any)?.amount ?? 5000

        // Delete/unpay
        await supabase
          .from('monthly_payments')
          .delete()
          .eq('member_id', memberId)
          .eq('month', month)
          .eq('year', year)

        // Update balance in members table (first member as organization)
        try {
          const { data: memberData, error: fetchError } = await supabase
            .from('members')
            .select('id, balance_cash, balance_bank')
            .order('name')
            .limit(1)
            .single()

          if (fetchError) {
            console.error('Error fetching member for balance update:', fetchError)
          } else if (memberData) {
            console.log('Current balance:', memberData)
            
            // Hitung balance baru dengan validasi tidak boleh minus
            let newCash = memberData.balance_cash || 0
            let newBank = memberData.balance_bank || 0
            
            if (oldMethod === 'cash') {
              newCash = Math.max(0, newCash - oldAmount) // Tidak boleh minus
            } else if (oldMethod === 'transfer') {
              newBank = Math.max(0, newBank - oldAmount) // Tidak boleh minus
            }
            
            console.log('New balance will be:', { newCash, newBank, oldMethod })
            
            const { error: updateError } = await supabase
              .from('members')
              .update({
                balance_cash: newCash,
                balance_bank: newBank
              })
              .eq('id', memberData.id)
            
            if (updateError) {
              console.error('Error updating balance:', updateError)
              alert('Gagal update saldo. Pastikan SQL script sudah dijalankan!')
            } else {
              console.log('Balance updated successfully in DB')
            }
          }
        } catch (balanceError) {
          console.error('Error in balance update:', balanceError)
          alert('Gagal update saldo. Pastikan SQL script sudah dijalankan!')
        }
        
        // Update local state immediately for snappy UI
        setPayments(prev => ({
          ...prev,
          [memberId]: {
            ...prev[memberId],
            [key]: { paid: false }
          }
        }))

        // Refresh from server to ensure balances & payments are consistent
        console.log('Refreshing data after unpay...')
        await fetchData()
        console.log('Data refreshed after unpay')
      } else {
        // Insert payment with method
        console.log('Inserting payment with method:', method)
        
        const { error: insertError } = await supabase
          .from('monthly_payments')
          .upsert({
            member_id: memberId,
            month,
            year,
            paid: true,
            paid_at: new Date().toISOString(),
            amount: 5000,
            payment_method: method
          } as any)
        
        if (insertError) {
          console.error('Error inserting payment:', insertError)
          throw insertError
        }
        
        // Update balance in members table (first member as organization)
        try {
          const { data: memberData, error: fetchError } = await supabase
            .from('members')
            .select('id, balance_cash, balance_bank')
            .order('name')
            .limit(1)
            .single()

          if (fetchError) {
            console.error('Error fetching member for balance update:', fetchError)
            alert('Gagal update saldo. Pastikan SQL script sudah dijalankan!')
          } else if (memberData) {
            console.log('Current balance before update:', memberData)
            
            // Hitung balance baru
            let newCash = memberData.balance_cash || 0
            let newBank = memberData.balance_bank || 0
            
            if (method === 'cash') {
              newCash = newCash + 5000
            } else if (method === 'transfer') {
              newBank = newBank + 5000
            }
            
            console.log('New balance will be:', { newCash, newBank, method })
            
            const { error: updateError } = await supabase
              .from('members')
              .update({
                balance_cash: newCash,
                balance_bank: newBank
              })
              .eq('id', memberData.id)
            
            if (updateError) {
              console.error('Error updating balance:', updateError)
              alert('Gagal update saldo. Pastikan SQL script sudah dijalankan!')
            } else {
              console.log('Balance updated successfully in DB')
            }
          }
        } catch (balanceError) {
          console.error('Error in balance update:', balanceError)
          alert('Gagal update saldo. Pastikan SQL script sudah dijalankan!')
        }
        
        // Update local state immediately for snappy UI
        setPayments(prev => ({
          ...prev,
          [memberId]: {
            ...prev[memberId],
            [key]: { paid: true, method }
          }
        }))

        // Refresh from server to ensure balances & payments are consistent
        console.log('Refreshing data after pay...')
        await fetchData()
        console.log('Data refreshed after pay')
      }
      
      setShowPaymentModal(false)
      setSelectedPayment(null)
    } catch (error) {
      console.error('Error toggling payment:', error)
      alert('Gagal mengupdate pembayaran')
    }
  }

  const updateCashBalance = async () => {
    if (profile?.role !== 'bendahara') return
    const newBalance = parseInt(tempCash) || 0
    
    try {
      // Update in database (first member as organization)
      const { data: memberData } = await supabase
        .from('members')
        .select('id')
        .limit(1)
        .single()

      if (memberData) {
        await supabase
          .from('members')
          .update({ balance_cash: newBalance })
          .eq('id', memberData.id)
      }
      
      setCashBalance(newBalance)
      setEditingCash(false)
    } catch (error) {
      console.error('Error updating cash balance:', error)
      alert('Gagal update saldo cash')
    }
  }

  const updateBankBalance = async () => {
    if (profile?.role !== 'bendahara') return
    const newBalance = parseInt(tempBank) || 0
    
    try {
      // Update in database (first member as organization)
      const { data: memberData } = await supabase
        .from('members')
        .select('id')
        .limit(1)
        .single()

      if (memberData) {
        await supabase
          .from('members')
          .update({ balance_bank: newBalance })
          .eq('id', memberData.id)
      }
      
      setBankBalance(newBalance)
      setEditingBank(false)
    } catch (error) {
      console.error('Error updating bank balance:', error)
      alert('Gagal update saldo m-banking')
    }
  }

  const addMember = async () => {
    if (!newMemberName.trim() || profile?.role !== 'bendahara') return

    setAddingMember(true)
    try {
      const { data, error } = await supabase
        .from('members')
        .insert({ name: newMemberName.trim().toUpperCase() })
        .select()
        .single()

      if (error) throw error

      // Insert in alphabetical order
      const newMembers = [...members, data].sort((a, b) => a.name.localeCompare(b.name))
      setMembers(newMembers)
      setNewMemberName('')
      setShowAddModal(false)
    } catch (error) {
      console.error('Error adding member:', error)
      alert('Gagal menambah anggota')
    } finally {
      setAddingMember(false)
    }
  }

  const deleteMember = async (memberId: string, memberName: string) => {
    if (profile?.role !== 'bendahara') return
    if (!confirm(`Yakin ingin menghapus ${memberName}?`)) return

    try {
      await supabase.from('members').delete().eq('id', memberId)
      setMembers(members.filter(m => m.id !== memberId))
    } catch (error) {
      console.error('Error deleting member:', error)
      alert('Gagal menghapus anggota')
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="bg-white rounded-lg p-8 border border-gray-200">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Gradient */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 p-4 sm:p-8 shadow-xl">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLW9wYWNpdHk9IjAuMSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-30"></div>
        <div className="relative flex flex-col sm:flex-row items-center sm:items-center justify-between gap-4">
          <div className="animate-fade-in text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2 sm:gap-3 mb-2">
              <div className="p-1.5 sm:p-2 bg-white/20 backdrop-blur-sm rounded-xl">
                <Users className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">Data Anggota</h1>
            </div>
            <p className="text-blue-100 text-xs sm:text-sm">Kelola pembayaran kas bulanan anggota Karang Taruna</p>
          </div>
          <div className="flex flex-wrap gap-2 sm:gap-3 w-full sm:w-auto">
            {profile?.role === 'bendahara' && (
              <>
                <button
                  onClick={() => setShowRangeModal(true)}
                  className="group relative flex-1 sm:flex-none px-4 sm:px-5 py-2 sm:py-3 bg-white/10 backdrop-blur-md hover:bg-white/20 text-white rounded-xl transition-all duration-300 flex items-center justify-center gap-2 text-xs sm:text-sm font-medium border border-white/20 hover:border-white/30 hover:shadow-lg hover:scale-105 active:scale-95"
                >
                  <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform group-hover:rotate-12" />
                  <span>Range</span>
                </button>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="group relative flex-1 sm:flex-none px-4 sm:px-5 py-2 sm:py-3 bg-white hover:bg-blue-50 text-blue-700 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 text-xs sm:text-sm font-medium shadow-lg hover:shadow-xl hover:scale-105 active:scale-95"
                >
                  <UserPlus className="w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform group-hover:rotate-12" />
                  <span>Tambah</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {/* Cash Balance */}
        <div className="bg-white rounded-lg p-4 sm:p-5 border border-gray-200">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <div className="flex items-center gap-2 sm:gap-3 flex-1 justify-center sm:justify-start">
              <div className="p-1.5 sm:p-2 bg-green-100 rounded-lg">
                <Wallet className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
              </div>
              <div className="text-center sm:text-left">
                <p className="text-xs sm:text-sm text-gray-600">Saldo Cash</p>
                {editingCash ? (
                  <input
                    type="number"
                    value={tempCash}
                    onChange={(e) => setTempCash(e.target.value)}
                    onBlur={updateCashBalance}
                    onKeyDown={(e) => e.key === 'Enter' && updateCashBalance()}
                    className="text-lg sm:text-xl font-bold text-gray-900 border-b-2 border-blue-500 focus:outline-none w-32 sm:w-40"
                    autoFocus
                  />
                ) : (
                  <p className="text-lg sm:text-xl font-bold text-green-600">{formatCurrency(cashBalance)}</p>
                )}
              </div>
            </div>
            {profile?.role === 'bendahara' && !editingCash && (
              <button
                onClick={() => {
                  setTempCash(cashBalance.toString())
                  setEditingCash(true)
                }}
                className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-600" />
              </button>
            )}
          </div>
        </div>

        {/* Bank Balance */}
        <div className="bg-white rounded-lg p-4 sm:p-5 border border-gray-200">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <div className="flex items-center gap-2 sm:gap-3 flex-1 justify-center sm:justify-start">
              <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg">
                <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
              </div>
              <div className="text-center sm:text-left">
                <p className="text-xs sm:text-sm text-gray-600">Saldo M-Banking</p>
                {editingBank ? (
                  <input
                    type="number"
                    value={tempBank}
                    onChange={(e) => setTempBank(e.target.value)}
                    onBlur={updateBankBalance}
                    onKeyDown={(e) => e.key === 'Enter' && updateBankBalance()}
                    className="text-lg sm:text-xl font-bold text-gray-900 border-b-2 border-blue-500 focus:outline-none w-32 sm:w-40"
                    autoFocus
                  />
                ) : (
                  <p className="text-lg sm:text-xl font-bold text-blue-600">{formatCurrency(bankBalance)}</p>
                )}
              </div>
            </div>
            {profile?.role === 'bendahara' && !editingBank && (
              <button
                onClick={() => {
                  setTempBank(bankBalance.toString())
                  setEditingBank(true)
                }}
                className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-600" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg overflow-hidden shadow-sm border border-gray-200">
        <div className="overflow-x-auto" style={{WebkitOverflowScrolling: 'touch'}}>
          <table className="w-full min-w-max">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-semibold text-gray-700 uppercase sticky left-0 bg-gray-50 z-10">
                  Nama
                </th>
                {months.map(({ month, year, label }) => (
                  <th key={`${month}-${year}`} className="px-2 sm:px-4 py-2 sm:py-3 text-center text-[10px] sm:text-xs font-semibold text-gray-700 uppercase min-w-[80px] sm:min-w-[120px]">
                    <span className="hidden sm:inline">{label}</span>
                    <span className="sm:hidden">{label.split(' ')[0]}</span>
                  </th>
                ))}
                {profile?.role === 'bendahara' && (
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-[10px] sm:text-xs font-semibold text-gray-700 uppercase min-w-[60px] sm:min-w-[80px]">
                    Aksi
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {members.map((member, idx) => (
                <tr
                  key={member.id}
                  className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                    idx % 2 === 0 ? 'bg-gray-50/50' : 'bg-white'
                  }`}
                >
                  <td className="px-3 sm:px-6 py-2 sm:py-4 text-xs sm:text-base font-medium text-gray-900 sticky left-0 z-10" style={{ backgroundColor: idx % 2 === 0 ? '#f9fafb' : '#ffffff' }}>
                    {member.name}
                  </td>
                  {months.map(({ month, year }) => {
                    const key = `${month}-${year}`
                    const paymentRecord = payments[member.id]?.[key]
                    const isPaid = paymentRecord?.paid || false
                    const method = paymentRecord?.method
                    const canEdit = profile?.role === 'bendahara'

                    return (
                      <td key={key} className="px-2 sm:px-4 py-2 sm:py-4 text-center">
                        <button
                          onClick={() => canEdit && openPaymentModal(member.id, month, year)}
                          disabled={!canEdit}
                          className={`w-6 h-6 sm:w-7 sm:h-7 rounded-md flex items-center justify-center mx-auto transition-all relative ${
                            isPaid
                              ? method === 'cash'
                                ? 'bg-green-100 border border-green-500 hover:bg-green-200'
                                : 'bg-blue-100 border border-blue-500 hover:bg-blue-200'
                              : 'bg-gray-100 border border-gray-300 hover:bg-gray-200'
                          } ${canEdit ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
                          title={isPaid ? (method === 'cash' ? 'Cash' : 'Transfer') : 'Belum bayar'}
                        >
                          {isPaid && <Check className={`w-3 h-3 sm:w-4 sm:h-4 ${method === 'cash' ? 'text-green-600' : 'text-blue-600'}`} />}
                        </button>
                      </td>
                    )
                  })}
                  {profile?.role === 'bendahara' && (
                    <td className="px-2 sm:px-4 py-2 sm:py-4 text-center">
                      <button
                        onClick={() => deleteMember(member.id, member.name)}
                        className="p-1.5 sm:p-2 rounded-md bg-red-50 hover:bg-red-100 border border-red-200 hover:border-red-300 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-600" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
        <div className="flex items-start gap-3">
          <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5"></div>
          <div>
            <p className="text-gray-900 text-sm">
              <span className="font-semibold">Total Anggota:</span> {members.length} orang
            </p>
            <p className="text-gray-600 text-xs mt-1">
              Iuran kas: Rp 5.000 per bulan. Klik kotak hijau untuk Cash, biru untuk Transfer.
            </p>
          </div>
        </div>
      </div>

      {/* Payment Method Modal */}
      {showPaymentModal && selectedPayment && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl p-8 max-w-sm w-full shadow-2xl border border-white/20 animate-slide-up">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl">
                  <Wallet className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Pilih Metode Pembayaran</h2>
              </div>
              <button
                onClick={() => {
                  setShowPaymentModal(false)
                  setSelectedPayment(null)
                }}
                className="p-2 hover:bg-gray-100 rounded-xl transition-all active:scale-95"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-6">Pilih cara pembayaran kas:</p>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handlePayment(selectedPayment.memberId, selectedPayment.month, selectedPayment.year, 'cash')}
                className="group p-6 border-2 border-green-200 rounded-2xl hover:bg-green-50 hover:border-green-400 transition-all hover:scale-105 active:scale-95 bg-gradient-to-br from-green-50 to-emerald-50"
              >
                <Wallet className="w-10 h-10 text-green-600 mx-auto mb-3 transition-transform group-hover:scale-110" />
                <p className="font-bold text-gray-900 text-lg">Cash</p>
                <p className="text-xs text-gray-600 mt-1">Tunai</p>
              </button>
              <button
                onClick={() => handlePayment(selectedPayment.memberId, selectedPayment.month, selectedPayment.year, 'transfer')}
                className="group p-6 border-2 border-blue-200 rounded-2xl hover:bg-blue-50 hover:border-blue-400 transition-all hover:scale-105 active:scale-95 bg-gradient-to-br from-blue-50 to-indigo-50"
              >
                <CreditCard className="w-10 h-10 text-blue-600 mx-auto mb-3 transition-transform group-hover:scale-110" />
                <p className="font-bold text-gray-900 text-lg">Transfer</p>
                <p className="text-xs text-gray-600 mt-1">M-Banking</p>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Range Month Modal */}
      {showRangeModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl p-8 max-w-lg w-full shadow-2xl border border-white/20 animate-slide-up">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Atur Range Bulan</h2>
            </div>
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm text-gray-700 font-semibold flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    Bulan Awal
                  </label>
                  <select
                    value={startMonth}
                    onChange={(e) => setStartMonth(parseInt(e.target.value))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white hover:border-gray-300"
                  >
                    {[...Array(12)].map((_, i) => (
                      <option key={i} value={i + 1}>
                        {new Date(2000, i, 1).toLocaleDateString('id-ID', { month: 'long' })}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-gray-700 font-semibold flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    Tahun Awal
                  </label>
                  <input
                    type="number"
                    value={startYear}
                    onChange={(e) => setStartYear(parseInt(e.target.value))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white hover:border-gray-300"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm text-gray-700 font-semibold flex items-center gap-2">
                    <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                    Bulan Akhir
                  </label>
                  <select
                    value={endMonth}
                    onChange={(e) => setEndMonth(parseInt(e.target.value))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-white hover:border-gray-300"
                  >
                    {[...Array(12)].map((_, i) => (
                      <option key={i} value={i + 1}>
                        {new Date(2000, i, 1).toLocaleDateString('id-ID', { month: 'long' })}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-gray-700 font-semibold flex items-center gap-2">
                    <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                    Tahun Akhir
                  </label>
                  <input
                    type="number"
                    value={endYear}
                    onChange={(e) => setEndYear(parseInt(e.target.value))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-white hover:border-gray-300"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowRangeModal(false)}
                  className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-xl hover:bg-gray-50 transition-all text-gray-700 font-semibold hover:border-gray-400 active:scale-95"
                >
                  Batal
                </button>
                <button
                  onClick={() => setShowRangeModal(false)}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all text-white font-semibold shadow-lg hover:shadow-xl active:scale-95"
                >
                  Terapkan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl p-8 max-w-md w-full shadow-2xl border border-white/20 animate-slide-up">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl">
                <UserPlus className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Tambah Anggota Baru</h2>
            </div>
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm text-gray-700 font-semibold flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  Nama Anggota
                </label>
                <input
                  type="text"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value.toUpperCase())}
                  placeholder="Masukkan nama..."
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all bg-white hover:border-gray-300"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && addMember()}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowAddModal(false)}
                  disabled={addingMember}
                  className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-xl hover:bg-gray-50 transition-all disabled:opacity-50 text-gray-700 font-semibold hover:border-gray-400 active:scale-95"
                >
                  Batal
                </button>
                <button
                  onClick={addMember}
                  disabled={addingMember || !newMemberName.trim()}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-white font-semibold shadow-lg hover:shadow-xl active:scale-95"
                >
                  {addingMember ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-5 h-5" />
                      Simpan
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
