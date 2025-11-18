'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Transaction, Profile } from '@/types/database.types'
import { Plus, TrendingUp, TrendingDown, Loader2, Trash2, Calendar, ArrowRightLeft, X, Wallet, CreditCard } from 'lucide-react'

export default function TransactionsPage() {
  const supabase = createClient()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'income' as 'income' | 'expense',
    amount: '',
    description: ''
  })
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer'>('cash')
  const [showMethodSelector, setShowMethodSelector] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [cashBalance, setCashBalance] = useState(0)
  const [bankBalance, setBankBalance] = useState(0)

  useEffect(() => {
    fetchData()
  }, [])

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

    // Get transactions
    const { data: transactionsData } = await supabase
      .from('transactions')
      .select('*')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })

    if (transactionsData) {
      setTransactions(transactionsData)
    }

    // Get balance from first member (organization)
    const { data: memberData } = await supabase
      .from('members')
      .select('balance_cash, balance_bank')
      .order('name')
      .limit(1)
      .single()

    if (memberData) {
      setCashBalance(memberData.balance_cash || 0)
      setBankBalance(memberData.balance_bank || 0)
    }

    setLoading(false)
  }

  const addTransaction = async () => {
    if (!formData.description.trim() || !formData.amount || profile?.role !== 'bendahara') return

    setSubmitting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const amount = parseInt(formData.amount)
      
      // Insert transaction with payment_method
      const { data, error } = await supabase
        .from('transactions')
        .insert({
          date: formData.date,
          type: formData.type,
          amount: amount,
          description: formData.description.trim(),
          created_by: user?.id,
          payment_method: paymentMethod
        })
        .select()
        .single()

      if (error) {
        console.error('Error inserting transaction:', error)
        throw error
      }

      // Update saldo di tabel members (ambil member pertama sebagai organisasi)
      try {
        const { data: membersData, error: membersError } = await supabase
          .from('members')
          .select('id, balance_cash, balance_bank')
          .order('name')
          .limit(1)
          .single()

        if (membersError) {
          console.error('Error fetching member:', membersError)
          // Jika error, skip update balance tapi tetap lanjut (transaksi sudah tersimpan)
        } else if (membersData) {
          const currentCash = membersData.balance_cash || 0
          const currentBank = membersData.balance_bank || 0
          
          let newCash = currentCash
          let newBank = currentBank

          if (formData.type === 'income') {
            // Pemasukan: tambah saldo
            if (paymentMethod === 'cash') {
              newCash = currentCash + amount
            } else {
              newBank = currentBank + amount
            }
          } else {
            // Pengeluaran: kurangi saldo
            if (paymentMethod === 'cash') {
              newCash = currentCash - amount
            } else {
              newBank = currentBank - amount
            }
          }

          // Update saldo
          const { error: updateError } = await supabase
            .from('members')
            .update({
              balance_cash: newCash,
              balance_bank: newBank
            })
            .eq('id', membersData.id)
          
          if (updateError) {
            console.error('Error updating balance:', updateError)
            alert('Transaksi tersimpan tapi gagal update saldo. Pastikan SQL script sudah dijalankan!')
          } else {
            console.log('Balance updated successfully')
            // Refresh balance from DB
            await fetchData()
          }
        }
      } catch (balanceError) {
        console.error('Error updating balance:', balanceError)
        alert('Transaksi tersimpan tapi gagal update saldo. Pastikan SQL script sudah dijalankan!')
      }

      setTransactions([data, ...transactions])
      setFormData({
        date: new Date().toISOString().split('T')[0],
        type: 'income',
        amount: '',
        description: ''
      })
      setPaymentMethod('cash')
      setShowMethodSelector(false)
      setShowAddModal(false)
    } catch (error) {
      console.error('Error adding transaction:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      alert(`Gagal menambah transaksi: ${errorMessage}`)
    } finally {
      setSubmitting(false)
    }
  }

  const deleteTransaction = async (id: string) => {
    if (profile?.role !== 'bendahara') return
    if (!confirm('Yakin ingin menghapus transaksi ini?')) return

    try {
      // Get transaction detail before delete
      const transaction = transactions.find(t => t.id === id)
      if (!transaction) return

      // Delete transaction
      await supabase.from('transactions').delete().eq('id', id)
      
      // Reverse saldo update
      if (transaction.payment_method) {
        const { data: membersData } = await supabase
          .from('members')
          .select('id, balance_cash, balance_bank')
          .order('name')
          .limit(1)
          .single()

        if (membersData) {
          const currentCash = membersData.balance_cash || 0
          const currentBank = membersData.balance_bank || 0
          
          let newCash = currentCash
          let newBank = currentBank

          // Reverse: jika dulu income dikurangi, jika dulu expense ditambah
          if (transaction.type === 'income') {
            if (transaction.payment_method === 'cash') {
              newCash = Math.max(0, currentCash - transaction.amount)
            } else {
              newBank = Math.max(0, currentBank - transaction.amount)
            }
          } else {
            if (transaction.payment_method === 'cash') {
              newCash = currentCash + transaction.amount
            } else {
              newBank = currentBank + transaction.amount
            }
          }

          await supabase
            .from('members')
            .update({
              balance_cash: newCash,
              balance_bank: newBank
            })
            .eq('id', membersData.id)
          
          // Refresh data to update balance cards
          await fetchData()
        }
      }

      setTransactions(transactions.filter(t => t.id !== id))
    } catch (error) {
      console.error('Error deleting transaction:', error)
      alert('Gagal menghapus transaksi')
    }
  }

  const calculateBalance = () => {
    return transactions.reduce((acc, t) => {
      return t.type === 'income' ? acc + t.amount : acc - t.amount
    }, 0)
  }

  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((acc, t) => acc + t.amount, 0)

  const totalExpense = transactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => acc + t.amount, 0)

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
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
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-teal-700 to-cyan-800 p-4 sm:p-8 shadow-xl">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLW9wYWNpdHk9IjAuMSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-30"></div>
        <div className="relative flex flex-col sm:flex-row items-center sm:items-center justify-between gap-4">
          <div className="animate-fade-in text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2 sm:gap-3 mb-2">
              <div className="p-1.5 sm:p-2 bg-white/20 backdrop-blur-sm rounded-xl">
                <ArrowRightLeft className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">Pemasukan & Pengeluaran</h1>
            </div>
            <p className="text-teal-100 text-xs sm:text-sm">Kelola catatan transaksi kas Karang Taruna</p>
          </div>
          {profile?.role === 'bendahara' && (
            <button
              onClick={() => setShowAddModal(true)}
              className="group relative px-5 py-3 bg-white hover:bg-blue-50 text-teal-700 rounded-xl transition-all duration-300 flex items-center gap-2 text-sm font-medium shadow-lg hover:shadow-xl hover:scale-105 active:scale-95"
            >
              <Plus className="w-4 h-4 transition-transform group-hover:rotate-90" />
              <span>Tambah Transaksi</span>
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg p-4 sm:p-5 border border-gray-200 relative overflow-hidden">
          <TrendingUp className="absolute -right-6 -bottom-6 w-32 h-32 text-green-600 opacity-5" />
          <div className="relative z-10">
            <div className="flex items-center justify-end mb-2 sm:mb-3">
              <span className="text-xs text-gray-500">Total</span>
            </div>
            <p className="text-lg sm:text-xl font-bold text-gray-900 mb-1 text-center">{formatCurrency(totalIncome)}</p>
            <p className="text-xs sm:text-sm text-green-600 text-center">Pemasukan</p>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 sm:p-5 border border-gray-200 relative overflow-hidden">
          <TrendingDown className="absolute -right-6 -bottom-6 w-32 h-32 text-red-600 opacity-5" />
          <div className="relative z-10">
            <div className="flex items-center justify-end mb-2 sm:mb-3">
              <span className="text-xs text-gray-500">Total</span>
            </div>
            <p className="text-lg sm:text-xl font-bold text-gray-900 mb-1 text-center">{formatCurrency(totalExpense)}</p>
            <p className="text-xs sm:text-sm text-red-600 text-center">Pengeluaran</p>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 sm:p-5 border border-gray-200 relative overflow-hidden">
          <TrendingUp className="absolute -right-6 -bottom-6 w-32 h-32 text-blue-600 opacity-5" />
          <div className="relative z-10">
            <div className="flex items-center justify-end mb-2 sm:mb-3">
              <span className="text-xs text-gray-500">Saldo</span>
            </div>
            <p className={`text-lg sm:text-xl font-bold mb-1 text-center ${
              calculateBalance() >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {formatCurrency(calculateBalance())}
            </p>
            <p className="text-xs sm:text-sm text-gray-600 text-center">Sisa Kas</p>
          </div>
        </div>
      </div>

      {/* Balance Cards - Cash & Transfer */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 sm:p-5 border-2 border-green-200 shadow-sm">
          <div className="flex items-center justify-center sm:justify-start gap-3">
            <div className="p-2 sm:p-3 bg-green-100 rounded-xl">
              <Wallet className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
            </div>
            <div className="text-center sm:text-left">
              <p className="text-xs sm:text-sm text-gray-600 font-medium">Saldo Cash</p>
              <p className="text-xl sm:text-2xl font-bold text-green-600">{formatCurrency(cashBalance)}</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg p-4 sm:p-5 border-2 border-blue-200 shadow-sm">
          <div className="flex items-center justify-center sm:justify-start gap-3">
            <div className="p-2 sm:p-3 bg-blue-100 rounded-xl">
              <CreditCard className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
            </div>
            <div className="text-center sm:text-left">
              <p className="text-xs sm:text-sm text-gray-600 font-medium">Saldo Transfer</p>
              <p className="text-xl sm:text-2xl font-bold text-blue-600">{formatCurrency(bankBalance)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Transactions List */}
      <div className="bg-white rounded-lg overflow-hidden shadow-sm border border-gray-200">
        <div className="overflow-x-auto" style={{WebkitOverflowScrolling: 'touch'}}>
          <table className="w-full min-w-max">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Tanggal</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Keterangan</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Tipe</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase">Metode</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Nominal</th>
                {profile?.role === 'bendahara' && (
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase">Aksi</th>
                )}
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    Belum ada transaksi
                  </td>
                </tr>
              ) : (
                transactions.map((transaction, idx) => (
                  <tr
                    key={transaction.id}
                    className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                      idx % 2 === 0 ? 'bg-gray-50/50' : 'bg-white'
                    }`}
                  >
                    <td className="px-6 py-4 text-gray-700 text-sm">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        {formatDate(transaction.date)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-900 font-medium">{transaction.description}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          transaction.type === 'income'
                            ? 'bg-green-100 text-green-700 border border-green-200'
                            : 'bg-red-100 text-red-700 border border-red-200'
                        }`}
                      >
                        {transaction.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {transaction.payment_method ? (
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
                            transaction.payment_method === 'cash'
                              ? 'bg-green-100 text-green-700 border border-green-200'
                              : 'bg-blue-100 text-blue-700 border border-blue-200'
                          }`}
                        >
                          {transaction.payment_method === 'cash' ? (
                            <><Wallet className="w-3 h-3" /> Cash</>
                          ) : (
                            <><CreditCard className="w-3 h-3" /> Transfer</>
                          )}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                    <td className={`px-6 py-4 text-right font-bold ${
                      transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {transaction.type === 'income' ? '+' : '-'} {formatCurrency(transaction.amount)}
                    </td>
                    {profile?.role === 'bendahara' && (
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => deleteTransaction(transaction.id)}
                          className="p-2 rounded-md bg-red-50 hover:bg-red-100 border border-red-200 hover:border-red-300 transition-colors"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Transaction Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl p-8 max-w-md w-full shadow-2xl border border-white/20 animate-slide-up">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl">
                  <Plus className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Tambah Transaksi</h2>
              </div>
            </div>
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm text-gray-700 font-semibold flex items-center gap-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                  Tanggal
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all bg-white hover:border-gray-300"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-gray-700 font-semibold flex items-center gap-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                  Tipe
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setFormData({ ...formData, type: 'income' })}
                    className={`group px-4 py-4 rounded-2xl transition-all hover:scale-105 active:scale-95 ${
                      formData.type === 'income'
                        ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-400 shadow-lg'
                        : 'bg-gray-50 border-2 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <TrendingUp className={`w-6 h-6 mx-auto mb-2 transition-transform group-hover:scale-110 ${
                      formData.type === 'income' ? 'text-green-600' : 'text-gray-400'
                    }`} />
                    <span className="text-sm font-semibold text-gray-900">Pemasukan</span>
                  </button>
                  <button
                    onClick={() => setFormData({ ...formData, type: 'expense' })}
                    className={`group px-4 py-4 rounded-2xl transition-all hover:scale-105 active:scale-95 ${
                      formData.type === 'expense'
                        ? 'bg-gradient-to-br from-red-50 to-pink-50 border-2 border-red-400 shadow-lg'
                        : 'bg-gray-50 border-2 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <TrendingDown className={`w-6 h-6 mx-auto mb-2 transition-transform group-hover:scale-110 ${
                      formData.type === 'expense' ? 'text-red-600' : 'text-gray-400'
                    }`} />
                    <span className="text-sm font-semibold text-gray-900">Pengeluaran</span>
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-gray-700 font-semibold flex items-center gap-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                  Nominal
                </label>
                <input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="50000"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all bg-white hover:border-gray-300"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-gray-700 font-semibold flex items-center gap-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                  Keterangan
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Misal: Untuk acara wisata..."
                  rows={3}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none transition-all bg-white hover:border-gray-300"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-gray-700 font-semibold flex items-center gap-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                  Metode Pembayaran
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    className={`group px-4 py-4 rounded-2xl transition-all hover:scale-105 active:scale-95 ${
                      paymentMethod === 'cash'
                        ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-400 shadow-lg'
                        : 'bg-gray-50 border-2 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Wallet className={`w-6 h-6 mx-auto mb-2 transition-transform group-hover:scale-110 ${
                      paymentMethod === 'cash' ? 'text-green-600' : 'text-gray-400'
                    }`} />
                    <span className="text-sm font-semibold text-gray-900">Cash</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('transfer')}
                    className={`group px-4 py-4 rounded-2xl transition-all hover:scale-105 active:scale-95 ${
                      paymentMethod === 'transfer'
                        ? 'bg-gradient-to-br from-blue-50 to-cyan-50 border-2 border-blue-400 shadow-lg'
                        : 'bg-gray-50 border-2 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <CreditCard className={`w-6 h-6 mx-auto mb-2 transition-transform group-hover:scale-110 ${
                      paymentMethod === 'transfer' ? 'text-blue-600' : 'text-gray-400'
                    }`} />
                    <span className="text-sm font-semibold text-gray-900">Transfer</span>
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowAddModal(false)}
                  disabled={submitting}
                  className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-xl hover:bg-gray-50 transition-all disabled:opacity-50 text-gray-700 font-semibold hover:border-gray-400 active:scale-95"
                >
                  Batal
                </button>
                <button
                  onClick={addTransaction}
                  disabled={submitting || !formData.description.trim() || !formData.amount}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-white font-semibold shadow-lg hover:shadow-xl active:scale-95"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      <Plus className="w-5 h-5" />
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
