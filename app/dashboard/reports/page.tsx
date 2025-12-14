'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Member, Profile } from '@/types/database.types'
import { FileText, AlertCircle, Loader2, Download, Wallet, CreditCard, TrendingUp, TrendingDown, Calendar, CheckCircle, XCircle, Eye, X, BarChart3 } from 'lucide-react'
import * as XLSX from 'xlsx-js-style'

interface PaymentRecord {
  paid: boolean
  method?: 'cash' | 'transfer'
}

interface PaymentMap {
  [memberId: string]: {
    [monthYear: string]: PaymentRecord
  }
}

interface MemberWithPayments {
  member: Member
  totalMonths: number
  paidMonths: number
  unpaidMonths: number
  missingPayments: string[]
}

export default function ReportsPage() {
  const supabase = createClient()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  
  // Financial data
  const [cashBalance, setCashBalance] = useState(0)
  const [bankBalance, setBankBalance] = useState(0)
  const [totalExpense, setTotalExpense] = useState(0)
  const [memberPayments, setMemberPayments] = useState(0)
  const [meetingCash, setMeetingCash] = useState(0)
  
  // Members with incomplete payments
  const [incompleteMembers, setIncompleteMembers] = useState<MemberWithPayments[]>([])
  
  // Preview modal
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [selectedMember, setSelectedMember] = useState<MemberWithPayments | null>(null)
  
  // Date range
  const [startMonth, setStartMonth] = useState(7) // Juli
  const [startYear, setStartYear] = useState(2025)
  const [endMonth, setEndMonth] = useState(11) // November
  const [endYear, setEndYear] = useState(2025)

  const getMonthsInRange = () => {
    const months = []
    let currentDate = new Date(startYear, startMonth - 1, 1)
    const endDate = new Date(endYear, endMonth - 1, 1)
    
    while (currentDate <= endDate) {
      months.push({
        month: currentDate.getMonth() + 1,
        year: currentDate.getFullYear(),
        label: currentDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
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

    // Get all transactions
    const { data: transactionsData } = await supabase
      .from('transactions')
      .select('*')

    if (transactionsData) {
      const expense = transactionsData
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0)
      setTotalExpense(expense)
    }

    // Get saldo from members table (first member as organization)
    const { data: memberData } = await supabase
      .from('members')
      .select('balance_cash, balance_bank')
      .order('name')
      .limit(1)
      .single()

    if (memberData) {
      console.log('Reports - Balance from DB:', memberData)
      setCashBalance(memberData.balance_cash || 0)
      setBankBalance(memberData.balance_bank || 0)
    }

    // Get all meetings cash
    const { data: meetingsData } = await supabase
      .from('meetings')
      .select('total_cash_collected')

    if (meetingsData) {
      const total = meetingsData.reduce((sum, m) => sum + (m.total_cash_collected || 0), 0)
      setMeetingCash(total)
    }

    // Get members and their payments
    const { data: membersData } = await supabase
      .from('members')
      .select('*')
      .eq('is_active', true)
      .order('name')

    if (membersData) {
      const { data: paymentsData } = await supabase
        .from('monthly_payments')
        .select('*')
        .in('member_id', membersData.map(m => m.id))

      // Calculate member payments and find incomplete ones
      let totalCash = 0
      let totalBank = 0
      let totalMemberPayments = 0
      const incomplete: MemberWithPayments[] = []

      membersData.forEach(member => {
        const memberPaymentsForPeriod: { [key: string]: PaymentRecord } = {}
        const missingPayments: string[] = []

        months.forEach(({ month, year, label }) => {
          const key = `${month}-${year}`
          const payment = paymentsData?.find(
            p => p.member_id === member.id && p.month === month && p.year === year
          )

          if (payment && payment.paid) {
            memberPaymentsForPeriod[key] = {
              paid: true,
              method: (payment as any).payment_method
            }
            totalMemberPayments += payment.amount
            
            if ((payment as any).payment_method === 'cash') {
              totalCash += payment.amount
            } else if ((payment as any).payment_method === 'transfer') {
              totalBank += payment.amount
            }
          } else {
            memberPaymentsForPeriod[key] = { paid: false }
            missingPayments.push(label)
          }
        })

        const paidCount = Object.values(memberPaymentsForPeriod).filter(p => p.paid).length
        const totalCount = months.length

        if (paidCount < totalCount) {
          incomplete.push({
            member,
            totalMonths: totalCount,
            paidMonths: paidCount,
            unpaidMonths: totalCount - paidCount,
            missingPayments
          })
        }
      })

      setMemberPayments(totalMemberPayments)
      setIncompleteMembers(incomplete)
    }

    setLoading(false)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount)
  }

  const calculateBalance = () => {
    // Saldo cash + bank sudah mencakup semua pemasukan dan pengeluaran
    // Jadi tinggal return total saldo saja
    return cashBalance + bankBalance
  }

  const exportReport = () => {
    const borderStyle = {
      top: { style: 'thin' },
      bottom: { style: 'thin' },
      left: { style: 'thin' },
      right: { style: 'thin' }
    }

    // Sheet 1: Ringkasan Keuangan
    const summaryData = [
      ['LAPORAN KEUANGAN KARANG TARUNA', ''],
      ['Tanggal Laporan:', new Date().toLocaleDateString('id-ID')],
      ['Periode:', `${months[0]?.label} - ${months[months.length - 1]?.label}`],
      ['', ''],
      ['RINGKASAN KEUANGAN', ''],
      ['Saldo Cash', cashBalance],
      ['Saldo M-Banking', bankBalance],
      ['Total Saldo', cashBalance + bankBalance],
      ['', ''],
      ['PEMASUKAN', ''],
      ['Iuran Anggota', memberPayments],
      ['Kas Pertemuan', meetingCash],
      ['Total Pemasukan', memberPayments + meetingCash],
      ['', ''],
      ['PENGELUARAN', ''],
      ['Total Pengeluaran', totalExpense],
      ['', ''],
      ['SALDO AKHIR', calculateBalance()]
    ]

    // Sheet 2: Anggota Belum Lunas
    const membersData = [
      ['DAFTAR ANGGOTA DENGAN PEMBAYARAN BELUM LUNAS', '', '', '', '', ''],
      ['', '', '', '', '', ''],
      ['Nama Anggota', 'Total Bulan', 'Sudah Bayar', 'Belum Bayar', 'Tunggakan (Rp)', 'Bulan yang Belum Dibayar'],
      ...incompleteMembers.map(m => [
        m.member.name,
        m.totalMonths,
        m.paidMonths,
        m.unpaidMonths,
        m.unpaidMonths * 5000,
        m.missingPayments.join(', ')
      ]),
      ['', '', '', '', '', ''],
      ['TOTAL TUNGGAKAN', '', '', '', incompleteMembers.reduce((sum, m) => sum + (m.unpaidMonths * 5000), 0), '']
    ]

    // Create workbook
    const wb = XLSX.utils.book_new()
    
    // Create worksheets
    const ws1 = XLSX.utils.aoa_to_sheet(summaryData)
    const ws2 = XLSX.utils.aoa_to_sheet(membersData)
    
    // Set column widths
    ws1['!cols'] = [{ wch: 28 }, { wch: 22 }]
    ws2['!cols'] = [{ wch: 28 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 22 }, { wch: 50 }]
    
    // Apply styling to Sheet 1
    const range1 = XLSX.utils.decode_range(ws1['!ref'] || 'A1')
    for (let R = range1.s.r; R <= range1.e.r; ++R) {
      for (let C = range1.s.c; C <= range1.e.c; ++C) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C })
        if (!ws1[cellAddress]) ws1[cellAddress] = { t: 's', v: '' }
        
        ws1[cellAddress].s = {
          border: borderStyle,
          alignment: { vertical: 'center', horizontal: C === 0 ? 'left' : 'right' }
        }
        
        // Title row
        if (R === 0) {
          ws1[cellAddress].s.font = { bold: true, sz: 14, color: { rgb: 'FFFFFF' } }
          ws1[cellAddress].s.fill = { fgColor: { rgb: '4472C4' } }
          ws1[cellAddress].s.alignment = { horizontal: 'center', vertical: 'center' }
        }
        
        // Section headers
        if ((R === 4 || R === 9 || R === 14 || R === 17) && C === 0) {
          ws1[cellAddress].s.font = { bold: true, sz: 11 }
          ws1[cellAddress].s.fill = { fgColor: { rgb: 'E7E6E6' } }
        }
        
        // Number formatting
        if (C === 1 && R > 0 && typeof ws1[cellAddress].v === 'number') {
          ws1[cellAddress].z = '#,##0'
        }
      }
    }
    
    // Apply styling to Sheet 2
    const range2 = XLSX.utils.decode_range(ws2['!ref'] || 'A1')
    for (let R = range2.s.r; R <= range2.e.r; ++R) {
      for (let C = range2.s.c; C <= range2.e.c; ++C) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C })
        if (!ws2[cellAddress]) ws2[cellAddress] = { t: 's', v: '' }
        
        ws2[cellAddress].s = {
          border: borderStyle,
          alignment: { vertical: 'center', horizontal: C === 0 || C === 5 ? 'left' : 'center' }
        }
        
        // Title row
        if (R === 0) {
          ws2[cellAddress].s.font = { bold: true, sz: 14, color: { rgb: 'FFFFFF' } }
          ws2[cellAddress].s.fill = { fgColor: { rgb: '4472C4' } }
          ws2[cellAddress].s.alignment = { horizontal: 'center', vertical: 'center' }
        }
        
        // Header row
        if (R === 2) {
          ws2[cellAddress].s.font = { bold: true, sz: 11 }
          ws2[cellAddress].s.fill = { fgColor: { rgb: 'D9E1F2' } }
          ws2[cellAddress].s.alignment = { horizontal: 'center', vertical: 'center' }
        }
        
        // Total row
        if (R === range2.e.r) {
          ws2[cellAddress].s.font = { bold: true }
          ws2[cellAddress].s.fill = { fgColor: { rgb: 'FFF2CC' } }
        }
        
        // Number formatting
        if ((C === 1 || C === 2 || C === 3) && R > 2 && typeof ws2[cellAddress].v === 'number') {
          ws2[cellAddress].z = '0'
        }
        if (C === 4 && R > 2 && typeof ws2[cellAddress].v === 'number') {
          ws2[cellAddress].z = '#,##0'
        }
      }
    }
    
    // Merge cells
    ws1['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }]
    ws2['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }]
    
    XLSX.utils.book_append_sheet(wb, ws1, 'Ringkasan Keuangan')
    XLSX.utils.book_append_sheet(wb, ws2, 'Anggota Belum Lunas')
    
    // Generate Excel file
    const fileName = `Laporan-Karangtaruna-${new Date().toLocaleDateString('id-ID').replace(/\//g, '-')}.xlsx`
    XLSX.writeFile(wb, fileName, { cellStyles: true })
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
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-600 via-amber-700 to-yellow-800 p-4 sm:p-8 shadow-xl">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLW9wYWNpdHk9IjAuMSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-30"></div>
        <div className="relative flex flex-col sm:flex-row items-center sm:items-center justify-between gap-4">
          <div className="animate-fade-in text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2 sm:gap-3 mb-2">
              <div className="p-1.5 sm:p-2 bg-white/20 backdrop-blur-sm rounded-xl">
                <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">Laporan Keuangan</h1>
            </div>
            <p className="text-orange-100 text-xs sm:text-sm">
              Periode: {months[0]?.label} - {months[months.length - 1]?.label}
            </p>
          </div>
          <button
            onClick={exportReport}
            className="group relative px-5 py-3 bg-white hover:bg-orange-50 text-orange-700 rounded-xl transition-all duration-300 flex items-center gap-2 text-sm font-medium shadow-lg hover:shadow-xl hover:scale-105 active:scale-95"
          >
            <Download className="w-4 h-4 transition-transform group-hover:translate-y-1" />
            <span>Export Laporan</span>
          </button>
        </div>
      </div>

      {/* Period Selector */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 sm:p-6 border-2 border-gray-200 shadow-sm">
        <div className="flex items-center gap-2 sm:gap-4 mb-3 sm:mb-4">
          <div className="p-1.5 sm:p-2 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl">
            <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <h3 className="text-base sm:text-lg font-bold text-gray-900">Atur Periode Laporan</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <div className="space-y-2">
            <label className="text-xs text-gray-700 font-semibold flex items-center gap-2">
              <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
              Bulan Awal
            </label>
            <select
              value={startMonth}
              onChange={(e) => setStartMonth(parseInt(e.target.value))}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all bg-white hover:border-gray-300 font-medium"
            >
              {[...Array(12)].map((_, i) => (
                <option key={i} value={i + 1}>
                  {new Date(2000, i, 1).toLocaleDateString('id-ID', { month: 'long' })}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs text-gray-700 font-semibold flex items-center gap-2">
              <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
              Tahun Awal
            </label>
            <select
              value={startYear}
              onChange={(e) => setStartYear(parseInt(e.target.value))}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all bg-white hover:border-gray-300 font-medium"
            >
              {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs text-gray-700 font-semibold flex items-center gap-2">
              <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
              Bulan Akhir
            </label>
            <select
              value={endMonth}
              onChange={(e) => setEndMonth(parseInt(e.target.value))}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all bg-white hover:border-gray-300 font-medium"
            >
              {[...Array(12)].map((_, i) => (
                <option key={i} value={i + 1}>
                  {new Date(2000, i, 1).toLocaleDateString('id-ID', { month: 'long' })}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs text-gray-700 font-semibold flex items-center gap-2">
              <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
              Tahun Akhir
            </label>
            <select
              value={endYear}
              onChange={(e) => setEndYear(parseInt(e.target.value))}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all bg-white hover:border-gray-300 font-medium"
            >
              {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Financial Summary */}
      <div>
        <div className="flex items-center justify-center sm:justify-start gap-2 sm:gap-3 mb-3 sm:mb-4">
          <div className="p-1.5 sm:p-2 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl">
            <Wallet className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <h2 className="text-base sm:text-lg font-bold text-gray-900">Ringkasan Keuangan</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Saldo Cash */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-5 border-2 border-green-200 shadow-sm hover:shadow-md transition-all duration-300 hover:scale-105">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-lg">
                <Wallet className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-gray-600 font-medium">Saldo Cash</p>
                <p className="text-xl font-bold text-green-600">{formatCurrency(cashBalance)}</p>
              </div>
            </div>
          </div>

          {/* Saldo M-Banking */}
          <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-5 border-2 border-blue-200 shadow-sm hover:shadow-md transition-all duration-300 hover:scale-105">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl shadow-lg">
                <CreditCard className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-gray-600 font-medium">Saldo M-Banking</p>
                <p className="text-xl font-bold text-blue-600">{formatCurrency(bankBalance)}</p>
              </div>
            </div>
          </div>

          {/* Total Saldo */}
          <div className="bg-gradient-to-br from-purple-50 to-fuchsia-50 rounded-2xl p-5 border-2 border-purple-200 shadow-sm hover:shadow-md transition-all duration-300 hover:scale-105">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-gradient-to-br from-purple-500 to-fuchsia-600 rounded-xl shadow-lg">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-gray-600 font-medium">Total Saldo</p>
                <p className="text-xl font-bold text-purple-600">{formatCurrency(cashBalance + bankBalance)}</p>
              </div>
            </div>
          </div>

          {/* Saldo Akhir */}
          <div className={`rounded-2xl p-5 border-2 shadow-sm hover:shadow-md transition-all duration-300 hover:scale-105 ${
            calculateBalance() >= 0 
              ? 'bg-gradient-to-br from-indigo-50 to-blue-50 border-indigo-200' 
              : 'bg-gradient-to-br from-red-50 to-rose-50 border-red-200'
          }`}>
            <div className="flex items-center gap-3 mb-2">
              <div className={`p-2 rounded-xl shadow-lg ${
                calculateBalance() >= 0 
                  ? 'bg-gradient-to-br from-indigo-500 to-blue-600' 
                  : 'bg-gradient-to-br from-red-500 to-rose-600'
              }`}>
                {calculateBalance() >= 0 ? (
                  <TrendingUp className="w-5 h-5 text-white" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-white" />
                )}
              </div>
              <div>
                <p className="text-xs text-gray-600 font-medium">Saldo Akhir</p>
                <p className={`text-xl font-bold ${calculateBalance() >= 0 ? 'text-indigo-600' : 'text-red-600'}`}>
                  {formatCurrency(calculateBalance())}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Income & Expense Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pemasukan */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border-2 border-gray-200 shadow-sm hover:shadow-md transition-all duration-300">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Pemasukan</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center pb-2 border-b border-gray-200">
              <span className="text-sm text-gray-600 font-medium">Iuran Anggota</span>
              <span className="font-semibold text-gray-900">{formatCurrency(memberPayments)}</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-gray-200">
              <span className="text-sm text-gray-600 font-medium">Kas Pertemuan</span>
              <span className="font-semibold text-gray-900">{formatCurrency(meetingCash)}</span>
            </div>
            <div className="flex justify-between items-center pt-2 bg-gradient-to-r from-emerald-50 to-teal-50 -mx-2 px-2 py-3 rounded-xl">
              <span className="text-sm font-bold text-gray-900">Total Pemasukan</span>
              <span className="font-bold text-emerald-600 text-lg">
                {formatCurrency(memberPayments + meetingCash)}
              </span>
            </div>
          </div>
        </div>

        {/* Pengeluaran */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border-2 border-gray-200 shadow-sm hover:shadow-md transition-all duration-300">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-gradient-to-br from-red-500 to-rose-600 rounded-xl shadow-lg">
              <TrendingDown className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Pengeluaran</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center pb-2 border-b border-gray-200">
              <span className="text-sm text-gray-600 font-medium">Total Pengeluaran</span>
              <span className="font-semibold text-gray-900">{formatCurrency(totalExpense)}</span>
            </div>
            <div className="flex justify-between items-center pt-2 bg-gradient-to-r from-red-50 to-rose-50 -mx-2 px-2 py-3 rounded-xl">
              <span className="text-sm font-bold text-gray-900">Total Pengeluaran</span>
              <span className="font-bold text-red-600 text-lg">{formatCurrency(totalExpense)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Incomplete Payments Section */}
      <div>
        <div className="flex items-center justify-center sm:justify-start gap-2 sm:gap-3 mb-3 sm:mb-4">
          <div className="p-1.5 sm:p-2 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl">
            <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <h2 className="text-base sm:text-lg font-bold text-gray-900">
            Anggota dengan Pembayaran Belum Lunas ({incompleteMembers.length})
          </h2>
        </div>

        {incompleteMembers.length === 0 ? (
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-4 sm:p-6 border-2 border-green-200 shadow-sm animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="p-2 sm:p-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-lg">
                <CheckCircle className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
              </div>
              <div>
                <p className="font-bold text-green-900 text-base sm:text-lg">Semua Anggota Sudah Lunas!</p>
                <p className="text-xs sm:text-sm text-green-700 mt-1 font-medium">
                  Semua anggota telah membayar iuran kas untuk periode {months[0]?.label} - {months[months.length - 1]?.label}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl overflow-hidden shadow-sm border-2 border-gray-200">
            <div className="overflow-x-auto" style={{WebkitOverflowScrolling: 'touch'}}>
              <table className="w-full min-w-max">
                <thead>
                  <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">
                      Nama Anggota
                    </th>
                    <th className="px-4 py-4 text-center text-xs font-bold text-gray-700 uppercase">
                      Total Bulan
                    </th>
                    <th className="px-4 py-4 text-center text-xs font-bold text-gray-700 uppercase">
                      Sudah Bayar
                    </th>
                    <th className="px-4 py-4 text-center text-xs font-bold text-gray-700 uppercase">
                      Belum Bayar
                    </th>
                    <th className="px-4 py-4 text-center text-xs font-bold text-gray-700 uppercase">
                      Tunggakan
                    </th>
                    <th className="px-4 py-4 text-center text-xs font-bold text-gray-700 uppercase">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {incompleteMembers.map((item, idx) => (
                    <tr
                      key={item.member.id}
                      className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                        idx % 2 === 0 ? 'bg-gray-50/50' : 'bg-white'
                      }`}
                    >
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {item.member.name}
                      </td>
                      <td className="px-4 py-4 text-center text-gray-700">
                        {item.totalMonths}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span className="font-semibold text-green-600">{item.paidMonths}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <XCircle className="w-4 h-4 text-red-600" />
                          <span className="font-semibold text-red-600">{item.unpaidMonths}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="font-bold text-red-600">
                          {formatCurrency(item.unpaidMonths * 5000)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <button
                          onClick={() => {
                            setSelectedMember(item)
                            setShowPreviewModal(true)
                          }}
                          className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl transition-all duration-300 flex items-center gap-2 mx-auto text-sm font-medium shadow-sm hover:shadow-md hover:scale-105 active:scale-95"
                        >
                          <Eye className="w-4 h-4" />
                          <span>Preview</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Summary Card */}
      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
        <div className="flex items-start gap-3">
          <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5"></div>
          <div className="flex-1">
            <p className="text-gray-900 text-sm">
              <span className="font-semibold">Catatan:</span> Laporan ini mencakup periode {months.length} bulan 
              ({months[0]?.label} - {months[months.length - 1]?.label})
            </p>
            <p className="text-gray-600 text-xs mt-1">
              Total tunggakan: {formatCurrency(incompleteMembers.reduce((sum, m) => sum + (m.unpaidMonths * 5000), 0))} 
              dari {incompleteMembers.length} anggota
            </p>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreviewModal && selectedMember && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full shadow-xl border border-gray-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Detail Pembayaran</h2>
                <p className="text-sm text-gray-600 mt-1">{selectedMember.member.name}</p>
              </div>
              <button
                onClick={() => {
                  setShowPreviewModal(false)
                  setSelectedMember(null)
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-4 border-2 border-blue-200 hover:scale-105 transition-all duration-300">
                <p className="text-xs text-blue-600 mb-1 font-semibold">Total Bulan</p>
                <p className="text-2xl font-bold text-blue-900">{selectedMember.totalMonths}</p>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-4 border-2 border-green-200 hover:scale-105 transition-all duration-300">
                <p className="text-xs text-green-600 mb-1 font-semibold">Sudah Bayar</p>
                <p className="text-2xl font-bold text-green-900">{selectedMember.paidMonths}</p>
              </div>
              <div className="bg-gradient-to-br from-red-50 to-rose-50 rounded-2xl p-4 border-2 border-red-200 hover:scale-105 transition-all duration-300">
                <p className="text-xs text-red-600 mb-1 font-semibold">Belum Bayar</p>
                <p className="text-2xl font-bold text-red-900">{selectedMember.unpaidMonths}</p>
              </div>
            </div>

            {/* Tunggakan */}
            <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl p-5 border-2 border-orange-200 mb-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-orange-700 font-bold">Total Tunggakan</p>
                  <p className="text-xs text-orange-600 mt-1 font-medium">Rp 5.000 × {selectedMember.unpaidMonths} bulan</p>
                </div>
                <p className="text-3xl font-bold text-orange-900">
                  {formatCurrency(selectedMember.unpaidMonths * 5000)}
                </p>
              </div>
            </div>

            {/* Bulan yang Belum Dibayar */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-gradient-to-br from-red-500 to-rose-600 rounded-xl">
                  <AlertCircle className="w-4 h-4 text-white" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">
                  Bulan yang Belum Dibayar ({selectedMember.missingPayments.length})
                </h3>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {selectedMember.missingPayments.map((month, i) => (
                  <div
                    key={i}
                    className="px-4 py-3 bg-gradient-to-br from-red-100 to-rose-100 text-red-700 rounded-xl text-center font-semibold border-2 border-red-200 hover:border-red-300 hover:scale-105 transition-all duration-300 shadow-sm"
                  >
                    {month}
                  </div>
                ))}
              </div>
            </div>

            {/* Close Button */}
            <div className="mt-6 pt-4 border-t-2 border-gray-200">
              <button
                onClick={() => {
                  setShowPreviewModal(false)
                  setSelectedMember(null)
                }}
                className="w-full px-4 py-3 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white rounded-xl transition-all duration-300 font-semibold shadow-sm hover:shadow-md hover:scale-105 active:scale-95"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
