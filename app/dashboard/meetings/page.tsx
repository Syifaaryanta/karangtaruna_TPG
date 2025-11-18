'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Meeting, Profile } from '@/types/database.types'
import { Plus, Calendar as CalendarIcon, MessageSquare, DollarSign, Loader2, Trash2, CalendarDays, MapPin, X } from 'lucide-react'

export default function MeetingsPage() {
  const supabase = createClient()
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    topic: '',
    location: '',
    total_cash_collected: '',
    notes: ''
  })
  const [submitting, setSubmitting] = useState(false)

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

    // Get meetings
    const { data: meetingsData } = await supabase
      .from('meetings')
      .select('*')
      .order('date', { ascending: false })

    if (meetingsData) {
      setMeetings(meetingsData)
    }

    setLoading(false)
  }

  const addMeeting = async () => {
    if (!formData.topic.trim() || profile?.role !== 'bendahara') return

    setSubmitting(true)
    try {
      const { data, error } = await supabase
        .from('meetings')
        .insert({
          date: formData.date,
          topic: formData.topic.trim(),
          location: formData.location.trim() || null,
          total_cash_collected: formData.total_cash_collected ? parseInt(formData.total_cash_collected) : 0,
          notes: formData.notes.trim() || null
        })
        .select()
        .single()

      if (error) throw error

      setMeetings([data, ...meetings])
      setFormData({
        date: new Date().toISOString().split('T')[0],
        topic: '',
        location: '',
        total_cash_collected: '',
        notes: ''
      })
      setShowAddModal(false)
    } catch (error) {
      console.error('Error adding meeting:', error)
      alert('Gagal menambah acara kumpulan')
    } finally {
      setSubmitting(false)
    }
  }

  const deleteMeeting = async (id: string) => {
    if (profile?.role !== 'bendahara') return
    if (!confirm('Yakin ingin menghapus acara ini?')) return

    try {
      await supabase.from('meetings').delete().eq('id', id)
      setMeetings(meetings.filter(m => m.id !== id))
    } catch (error) {
      console.error('Error deleting meeting:', error)
      alert('Gagal menghapus acara')
    }
  }

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

  const totalCashCollected = meetings.reduce((acc, m) => acc + m.total_cash_collected, 0)

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
    <div className="space-y-4 md:space-y-6 overflow-x-hidden">
      {/* Header with Gradient */}
      <div className="relative overflow-hidden rounded-xl md:rounded-2xl bg-gradient-to-br from-purple-600 via-violet-700 to-indigo-800 p-4 md:p-8 shadow-xl">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLW9wYWNpdHk9IjAuMSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-30"></div>
        <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="animate-fade-in">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-white/20 backdrop-blur-sm rounded-xl">
                <CalendarDays className="w-5 h-5 md:w-6 md:h-6 text-white" />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">Acara Kumpulan Rutin</h1>
            </div>
            <p className="text-purple-100 text-xs md:text-sm">Kelola acara dan pencatatan kas kumpulan bulanan</p>
          </div>
          {profile?.role === 'bendahara' && (
            <button
              onClick={() => setShowAddModal(true)}
              className="group relative px-4 md:px-5 py-2.5 md:py-3 bg-white hover:bg-purple-50 text-purple-700 rounded-xl transition-all duration-300 flex items-center gap-2 text-xs md:text-sm font-medium shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 w-full md:w-auto justify-center"
            >
              <Plus className="w-4 h-4 transition-transform group-hover:rotate-90" />
              <span>Tambah Acara</span>
            </button>
          )}
        </div>
      </div>

      {/* Summary Card */}
      <div className="bg-white rounded-lg p-4 md:p-5 border border-gray-200">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-purple-100 rounded-lg">
            <DollarSign className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalCashCollected)}</p>
            <p className="text-gray-600 text-sm mt-1">Total kas terkumpul dari {meetings.length} acara</p>
          </div>
        </div>
      </div>

      {/* Meetings Grid */}
      {meetings.length === 0 ? (
        <div className="bg-white rounded-lg p-12 text-center border border-gray-200">
          <CalendarIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">Belum ada acara kumpulan</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          {meetings.map((meeting) => (
            <div
              key={meeting.id}
              className="bg-white rounded-lg p-4 md:p-5 border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all group"
            >
              {/* Date Badge */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-lg">
                  <CalendarIcon className="w-4 h-4 text-gray-600" />
                  <span className="text-sm text-gray-700 font-medium">{formatDate(meeting.date)}</span>
                </div>
                {profile?.role === 'bendahara' && (
                  <button
                    onClick={() => deleteMeeting(meeting.id)}
                    className="p-2 rounded-md bg-red-50 hover:bg-red-100 border border-red-200 hover:border-red-300 transition-all opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </button>
                )}
              </div>

              {/* Topic */}
              <h3 className="text-lg font-bold text-gray-900 mb-3 line-clamp-2">{meeting.topic}</h3>

              {/* Location */}
              {meeting.location && (
                <div className="flex items-center gap-2 text-gray-600 mb-4">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-sm">{meeting.location}</span>
                </div>
              )}

              {/* Cash Collected */}
              <div className="bg-gray-50 rounded-lg p-3 mb-3 border border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-green-600" />
                    <span className="text-sm text-gray-600">Kas Terkumpul</span>
                  </div>
                  <span className="text-base font-bold text-green-600">
                    {formatCurrency(meeting.total_cash_collected)}
                  </span>
                </div>
              </div>

              {/* Notes */}
              {meeting.notes && (
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <div className="flex items-start gap-2">
                    <MessageSquare className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-gray-600 line-clamp-3">{meeting.notes}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Meeting Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl p-8 max-w-lg w-full shadow-2xl border border-white/20 max-h-[90vh] overflow-y-auto animate-slide-up">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl">
                <CalendarDays className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Tambah Acara Kumpulan</h2>
            </div>
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm text-gray-700 font-semibold flex items-center gap-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  Tanggal Acara
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all bg-white hover:border-gray-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm text-gray-700 font-semibold flex items-center gap-2">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    Tempat
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="Balai Desa"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all bg-white hover:border-gray-300"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-gray-700 font-semibold flex items-center gap-2">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    Total Kas Terkumpul
                  </label>
                  <input
                    type="number"
                    value={formData.total_cash_collected}
                    onChange={(e) => setFormData({ ...formData, total_cash_collected: e.target.value })}
                    placeholder="50000"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all bg-white hover:border-gray-300"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-gray-700 font-semibold flex items-center gap-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  Topik Pembahasan
                </label>
                <input
                  type="text"
                  value={formData.topic}
                  onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                  placeholder="Misal: Membahas agenda tahun baru"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all bg-white hover:border-gray-300"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-gray-700 font-semibold flex items-center gap-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  Catatan (Opsional)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Catatan tambahan tentang acara..."
                  rows={4}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none transition-all bg-white hover:border-gray-300"
                />
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
                  onClick={addMeeting}
                  disabled={submitting || !formData.topic.trim()}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-white font-semibold shadow-lg hover:shadow-xl active:scale-95"
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
