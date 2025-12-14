'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Meeting, Profile, Member } from '@/types/database.types'
import { Plus, Calendar as CalendarIcon, MessageSquare, DollarSign, Loader2, Trash2, CalendarDays, MapPin, X } from 'lucide-react'

export default function MeetingsPage() {
  const supabase = createClient()
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showSpinModal, setShowSpinModal] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [spinning, setSpinning] = useState(false)
  const [rotation, setRotation] = useState(0)
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    topic: '',
    location: '',
    total_cash_collected: '',
    notes: ''
  })
  const [submitting, setSubmitting] = useState(false)
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletingMeetingId, setDeletingMeetingId] = useState<string | null>(null)
  const [editFormData, setEditFormData] = useState({
    date: '',
    topic: '',
    location: '',
    total_cash_collected: '',
    notes: ''
  })

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (showSpinModal) {
      fetchMembers()
    }
  }, [showSpinModal])

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

    // Get active members for spin wheel
    const { data: membersData, error: membersError } = await supabase
      .from('members')
      .select('*')
      .eq('is_active', true)
      .order('name')

    if (membersError) {
      console.error('Error fetching members:', membersError)
    }

    if (membersData) {
      console.log('Members loaded:', membersData)
      setMembers(membersData)
    }

    setLoading(false)
  }

  const fetchMembers = async () => {
    setLoadingMembers(true)
    console.log('Fetching members for spin wheel...')
    
    try {
      const { data: membersData, error: membersError } = await supabase
        .from('members')
        .select('*')
        .eq('is_active', true)
        .order('name')

      if (membersError) {
        console.error('Error fetching members:', membersError)
        showToastNotification('Gagal memuat data anggota: ' + membersError.message)
      } else {
        console.log('Members fetched successfully:', membersData)
        setMembers(membersData || [])
      }
    } catch (error) {
      console.error('Exception fetching members:', error)
    } finally {
      setLoadingMembers(false)
    }
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
      showToastNotification('Gagal menambah acara kumpulan')
    } finally {
      setSubmitting(false)
    }
  }

  const openDeleteModal = (id: string) => {
    if (profile?.role !== 'bendahara') return
    setDeletingMeetingId(id)
    setShowDeleteModal(true)
  }

  const deleteMeeting = async () => {
    if (!deletingMeetingId) return

    setSubmitting(true)
    try {
      await supabase.from('meetings').delete().eq('id', deletingMeetingId)
      setMeetings(meetings.filter(m => m.id !== deletingMeetingId))
      setShowDeleteModal(false)
      setDeletingMeetingId(null)
      showToastNotification('Acara berhasil dihapus')
    } catch (error) {
      console.error('Error deleting meeting:', error)
      showToastNotification('Gagal menghapus acara')
    } finally {
      setSubmitting(false)
    }
  }

  const spinWheel = () => {
    if (spinning || members.length === 0) return
    
    setSpinning(true)
    
    // Random rotations (5-10 full spins + random angle)
    const spins = 5 + Math.floor(Math.random() * 6)
    const randomAngle = Math.floor(Math.random() * 360)
    const totalRotation = rotation + (spins * 360) + randomAngle
    
    setRotation(totalRotation)
    
    // Calculate winner after animation
    setTimeout(() => {
      const anglePerMember = 360 / members.length
      // Panah ada di kanan (0°), segment pertama di -90° (atas)
      // Ketika wheel berputar, posisi relatif panah = -rotation
      // Jarak dari segment pertama ke posisi panah relatif
      const normalizedRotation = ((totalRotation % 360) + 360) % 360
      const relativeArrowPosition = (90 - normalizedRotation + 360) % 360
      const winnerIndex = Math.floor(relativeArrowPosition / anglePerMember) % members.length
      
      setSelectedMember(members[winnerIndex])
      setSpinning(false)
    }, 4000) // 4 seconds animation
  }

  const confirmSpinResult = async () => {
    if (!selectedMember) return
    
    setSubmitting(true)
    try {
      // Get next month
      const nextMonth = new Date()
      nextMonth.setMonth(nextMonth.getMonth() + 1)
      
      const { data, error } = await supabase
        .from('meetings')
        .insert({
          date: nextMonth.toISOString().split('T')[0],
          topic: `Kumpulan Bulan ${nextMonth.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}`,
          location: `Rumah ${selectedMember.name}`,
          total_cash_collected: 0,
          notes: `Tuan rumah dipilih melalui undian: ${selectedMember.name}`
        })
        .select()
        .single()

      if (error) throw error

      setMeetings([data, ...meetings])
      setShowConfirmModal(false)
      setShowSpinModal(false)
      setSelectedMember(null)
      setRotation(0)
      showToastNotification(`Berhasil! Tuan rumah: ${selectedMember.name}`)
    } catch (error) {
      console.error('Error saving meeting:', error)
      showToastNotification('Gagal menyimpan hasil undian')
    } finally {
      setSubmitting(false)
    }
  }

  const resetSpin = () => {
    setSelectedMember(null)
    setRotation(0)
  }

  const showToastNotification = (message: string) => {
    setToastMessage(message)
    setShowToast(true)
    setTimeout(() => setShowToast(false), 3000)
  }

  const openEditModal = (meeting: Meeting) => {
    setEditingMeeting(meeting)
    setEditFormData({
      date: meeting.date,
      topic: meeting.topic,
      location: meeting.location || '',
      total_cash_collected: meeting.total_cash_collected.toString(),
      notes: meeting.notes || ''
    })
    setShowEditModal(true)
  }

  const updateMeeting = async () => {
    if (!editingMeeting || !editFormData.topic.trim() || profile?.role !== 'bendahara') return

    setSubmitting(true)
    try {
      const { data, error } = await supabase
        .from('meetings')
        .update({
          date: editFormData.date,
          topic: editFormData.topic.trim(),
          location: editFormData.location.trim() || null,
          total_cash_collected: editFormData.total_cash_collected ? parseInt(editFormData.total_cash_collected) : 0,
          notes: editFormData.notes.trim() || null
        })
        .eq('id', editingMeeting.id)
        .select()
        .single()

      if (error) throw error

      setMeetings(meetings.map(m => m.id === editingMeeting.id ? data : m))
      setShowEditModal(false)
      setEditingMeeting(null)
      showToastNotification('Acara berhasil diperbarui!')
    } catch (error) {
      console.error('Error updating meeting:', error)
      showToastNotification('Gagal memperbarui acara')
    } finally {
      setSubmitting(false)
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
            <div className="flex gap-2 w-full md:w-auto">
              <button
                onClick={() => setShowSpinModal(true)}
                className="group relative px-4 md:px-5 py-2.5 md:py-3 bg-white/10 backdrop-blur-xl hover:bg-white/20 border border-white/30 hover:border-white/50 text-white rounded-xl transition-all duration-300 flex items-center gap-2 text-xs md:text-sm font-medium shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 flex-1 md:flex-initial justify-center"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" strokeWidth="2"/>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6l4 2"/>
                </svg>
                <span>WhileSpin</span>
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="group relative px-4 md:px-5 py-2.5 md:py-3 bg-white hover:bg-purple-50 text-purple-700 rounded-xl transition-all duration-300 flex items-center gap-2 text-xs md:text-sm font-medium shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 flex-1 md:flex-initial justify-center"
              >
                <Plus className="w-4 h-4 transition-transform group-hover:rotate-90" />
                <span>Tambah Acara</span>
              </button>
            </div>
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
              onClick={() => profile?.role === 'bendahara' && openEditModal(meeting)}
              className="bg-white rounded-lg p-4 md:p-5 border border-gray-200 hover:border-purple-300 hover:shadow-md transition-all group cursor-pointer"
            >
              {/* Date Badge */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-lg">
                  <CalendarIcon className="w-4 h-4 text-gray-600" />
                  <span className="text-sm text-gray-700 font-medium">{formatDate(meeting.date)}</span>
                </div>
                {profile?.role === 'bendahara' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      openDeleteModal(meeting.id)
                    }}
                    className="p-2 rounded-md bg-red-50 hover:bg-red-100 border border-red-200 hover:border-red-300 transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100"
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

      {/* Spin Wheel Modal */}
      {showSpinModal && (
        <div className="fixed inset-0 bg-gradient-to-br from-indigo-950 via-purple-950 to-black z-50 flex flex-col animate-fade-in overflow-hidden">
          {/* Galaxy Background with Stars */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {/* Nebula clouds */}
            <div className="absolute top-20 left-10 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
            <div className="absolute top-1/3 right-1/4 w-64 h-64 bg-pink-500/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
            <div className="absolute bottom-1/3 left-1/4 w-64 h-64 bg-cyan-500/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '3s' }}></div>
            
            {/* Animated Stars */}
            {[...Array(50)].map((_, i) => (
              <div
                key={i}
                className="absolute bg-white rounded-full animate-pulse"
                style={{
                  width: Math.random() * 3 + 1 + 'px',
                  height: Math.random() * 3 + 1 + 'px',
                  top: Math.random() * 100 + '%',
                  left: Math.random() * 100 + '%',
                  opacity: Math.random() * 0.7 + 0.3,
                  animationDuration: Math.random() * 3 + 2 + 's',
                  animationDelay: Math.random() * 2 + 's'
                }}
              />
            ))}
            
            {/* Shooting Stars / Meteors - Random positions */}
            {[...Array(3)].map((_, i) => {
              const randomLeft = Math.random() * 80 + 10;
              const randomWidth = Math.random() * 60 + 80;
              return (
                <div
                  key={`meteor-${i}`}
                  className="absolute bg-gradient-to-br from-white/60 via-white/40 to-transparent rounded-full"
                  style={{
                    width: `${randomWidth}px`,
                    height: '2px',
                    top: '-50px',
                    left: `${randomLeft}%`,
                    transform: 'rotate(-45deg)',
                    animation: 'meteor 3s linear infinite',
                    animationDelay: `${i * 5}s`,
                    boxShadow: '0 0 10px rgba(255,255,255,0.5)'
                  }}
                />
              );
            })}
          </div>
          
          <style jsx>{`
            @keyframes meteor {
              0% {
                transform: translateX(0) translateY(0) rotate(-45deg);
                opacity: 0;
              }
              10% {
                opacity: 1;
              }
              70% {
                opacity: 1;
              }
              100% {
                transform: translateX(-100vw) translateY(100vh) rotate(-45deg);
                opacity: 0;
              }
            }
          `}</style>
          <div className="w-full h-full flex flex-col relative z-10">
            {/* Header */}
            <div className="flex items-center justify-between p-4 md:p-6">
              <div className="flex items-center gap-3">
                <svg className="w-8 h-8 md:w-10 md:h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2"/>
                </svg>
                <h2 className="text-xl md:text-3xl font-bold text-white drop-shadow-lg">Spin Tuan Rumah Selanjutnya</h2>
              </div>
              <button
                onClick={() => {
                  setShowSpinModal(false)
                  setSelectedMember(null)
                  setRotation(0)
                }}
                className="p-2 md:p-3 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-6 h-6 md:w-8 md:h-8 text-white" />
              </button>
            </div>

            {loadingMembers ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <Loader2 className="w-16 h-16 md:w-20 md:h-20 animate-spin text-green-500 mx-auto mb-4" />
                  <p className="text-white text-lg md:text-xl">Memuat data anggota...</p>
                </div>
              </div>
            ) : members.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center px-4">
                  <div className="mb-4">
                    <svg className="w-20 h-20 md:w-24 md:h-24 text-gray-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                  <p className="text-white text-xl md:text-2xl font-semibold mb-2">Tidak ada anggota aktif untuk diundi</p>
                  <p className="text-gray-400 text-sm md:text-base mb-6">Silakan tambahkan anggota terlebih dahulu di menu Data Anggota</p>
                  <button
                    onClick={fetchMembers}
                    className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl transition-colors font-semibold"
                  >
                    Coba Muat Ulang
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col justify-center items-center px-4 pb-4 overflow-hidden">
                {/* Spin Wheel */}
                <div className="relative flex items-center justify-center flex-1 w-full py-4 md:py-8">
                  

                  {/* Wheel Container with Planet Glow Effect */}
                  <div className="relative w-full max-w-[70vmin] md:max-w-[65vmin] aspect-square flex items-center justify-center">
                    {/* Planet Glow Effect - Behind wheel */}
                    <div className="absolute inset-0 -z-10">
                      {/* Outer glow */}
                      <div className="absolute inset-0 rounded-full" 
                        style={{
                          background: 'radial-gradient(circle, rgba(147,112,219,0.15) 0%, rgba(138,43,226,0.1) 30%, transparent 70%)',
                          filter: 'blur(20px)',
                          transform: 'scale(1.2)'
                        }}
                      ></div>
                      {/* Middle glow */}
                      <div className="absolute inset-0 rounded-full" 
                        style={{
                          background: 'radial-gradient(circle, rgba(186,85,211,0.12) 0%, rgba(147,51,234,0.08) 40%, transparent 70%)',
                          filter: 'blur(30px)',
                          transform: 'scale(1.3)'
                        }}
                      ></div>
                      {/* Subtle atmosphere glow */}
                      <div className="absolute inset-0 rounded-full" 
                        style={{
                          background: 'radial-gradient(circle, rgba(255,255,255,0.03) 0%, rgba(147,112,219,0.06) 50%, transparent 75%)',
                          filter: 'blur(40px)',
                          transform: 'scale(1.4)'
                        }}
                      ></div>
                    </div>
                    {/* Simple Triangle Pointer - positioned outside wheel */}
                    <div className="absolute top-1/2 -translate-y-1/2 -right-6 md:-right-8 z-20" style={{ filter: 'drop-shadow(0 4px 12px rgba(255,215,0,0.6))' }}>
                      <div className="w-0 h-0 border-t-[18px] border-t-transparent border-b-[18px] border-b-transparent border-r-[28px] md:border-t-[24px] md:border-b-[24px] md:border-r-[36px]" 
                        style={{ 
                          borderRightColor: 'rgba(255,215,0,0.95)',
                          filter: 'drop-shadow(0 2px 10px rgba(255,215,0,0.5))'
                        }}
                      ></div>
                    </div>
                    <div 
                      className="relative w-full h-full rounded-full overflow-hidden backdrop-blur-xl"
                      style={{
                        transform: `rotate(${rotation}deg)`,
                        transition: spinning ? 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none',
                        boxShadow: '0 30px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.1), inset 0 0 60px rgba(255,255,255,0.15)',
                        background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)'
                      }}
                    >
                      {/* Wheel Segments */}
                      <svg viewBox="0 0 100 100" className="w-full h-full">
                        {members.map((member, index) => {
                          const anglePerMember = 360 / members.length
                          const startAngle = index * anglePerMember - 90
                          const endAngle = startAngle + anglePerMember
                          
                          const x1 = 50 + 50 * Math.cos((startAngle * Math.PI) / 180)
                          const y1 = 50 + 50 * Math.sin((startAngle * Math.PI) / 180)
                          const x2 = 50 + 50 * Math.cos((endAngle * Math.PI) / 180)
                          const y2 = 50 + 50 * Math.sin((endAngle * Math.PI) / 180)
                          
                          const largeArc = anglePerMember > 180 ? 1 : 0
                          const colors = [
                            '#3B82F6', '#EF4444', '#10B981', '#F59E0B',
                            '#8B5CF6', '#EC4899', '#6366F1', '#F97316',
                            '#14B8A6', '#F43F5E', '#A855F7', '#06B6D4'
                          ]
                          const color = colors[index % colors.length]

                          // Calculate text position and rotation for VERTICAL text
                          const textAngle = startAngle + anglePerMember / 2 + 90
                          const textRadius = 38 // Increased from 30 to 38 for better positioning

                          return (
                            <g key={member.id}>
                              {/* Segment with gradient effect */}
                              <defs>
                                <linearGradient id={`gradient-${index}`} x1="0%" y1="0%" x2="100%" y2="100%">
                                  <stop offset="0%" style={{ stopColor: color, stopOpacity: 1 }} />
                                  <stop offset="100%" style={{ stopColor: color, stopOpacity: 0.8 }} />
                                </linearGradient>
                              </defs>
                              <path
                                d={`M 50 50 L ${x1} ${y1} A 50 50 0 ${largeArc} 1 ${x2} ${y2} Z`}
                                fill={`url(#gradient-${index})`}
                                stroke="#ffffff"
                                strokeWidth="0.5"
                              />
                              {/* Member Name - VERTICAL */}
                              <g transform={`rotate(${textAngle}, 50, 50)`}>
                                {member.name.split('').map((char, charIndex) => (
                                  <text
                                    key={charIndex}
                                    x="50"
                                    y={50 - textRadius + charIndex * 4.2}
                                    fill="#ffffff"
                                    fontSize="4.2"
                                    fontWeight="900"
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                    style={{
                                      filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.9))',
                                      letterSpacing: '0.8px',
                                      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif'
                                    }}
                                  >
                                    {char.toUpperCase()}
                                  </text>
                                ))}
                              </g>
                            </g>
                          )
                        })}
                      </svg>

                      {/* Center Circle with glassmorphism */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-[15%] h-[15%] min-w-[60px] min-h-[60px] rounded-full flex items-center justify-center relative backdrop-blur-md"
                          style={{ 
                            background: 'linear-gradient(135deg, rgba(255,215,0,0.9) 0%, rgba(255,165,0,0.8) 100%)',
                            boxShadow: '0 15px 40px rgba(255,215,0,0.4), 0 0 0 3px rgba(255,255,255,0.3), inset 0 2px 20px rgba(255,255,255,0.5)',
                            border: '4px solid rgba(255,255,255,0.4)'
                          }}
                        >
                          <div className="text-2xl md:text-4xl font-bold text-white" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>★</div>
                        </div>
                      </div>
                    </div>

                    {/* Outer Ring with glassmorphism */}
                    <div className="absolute inset-0 rounded-full border-[10px] md:border-[14px] pointer-events-none" style={{ 
                      borderColor: 'rgba(255,255,255,0.3)',
                      boxShadow: 'inset 0 0 40px rgba(0,0,0,0.4), 0 0 60px rgba(255,255,255,0.2), 0 0 0 1px rgba(255,255,255,0.1)',
                      background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 100%)'
                    }}></div>
                  </div>
                </div>

                {/* Result Display */}
                {selectedMember && !spinning && (
                  <div className="mt-4 backdrop-blur-xl border-2 rounded-2xl p-4 md:p-6 text-center animate-bounce mx-4" 
                    style={{
                      background: 'linear-gradient(135deg, rgba(147,51,234,0.3) 0%, rgba(79,70,229,0.3) 100%)',
                      borderColor: 'rgba(255,255,255,0.3)',
                      boxShadow: '0 20px 50px rgba(147,51,234,0.4), inset 0 1px 20px rgba(255,255,255,0.2)'
                    }}>
                    <p className="text-white text-sm md:text-base mb-1 md:mb-2 font-semibold">Terpilih sebagai Tuan Rumah:</p>
                    <p className="text-2xl md:text-4xl font-bold text-white drop-shadow-lg">{selectedMember.name}</p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="w-full px-4 pb-4 md:pb-6 mt-4">
                  <div className="flex gap-3 max-w-2xl mx-auto">
                    {!selectedMember ? (
                      <button
                        onClick={spinWheel}
                        disabled={spinning}
                        className="flex-1 px-6 py-4 md:py-5 backdrop-blur-xl text-white rounded-xl md:rounded-2xl font-bold text-base md:text-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 border-2"
                        style={{
                          background: 'linear-gradient(135deg, rgba(147,51,234,0.6) 0%, rgba(79,70,229,0.6) 100%)',
                          borderColor: 'rgba(255,255,255,0.3)',
                          boxShadow: '0 20px 50px rgba(147,51,234,0.5), inset 0 1px 20px rgba(255,255,255,0.2)'
                        }}
                      >
                        {spinning ? (
                          <>
                            <Loader2 className="w-6 h-6 md:w-8 md:h-8 animate-spin" />
                            <span>Sedang Mengundi...</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-6 h-6 md:w-8 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <circle cx="12" cy="12" r="10" strokeWidth="2"/>
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6l4 2"/>
                            </svg>
                            <span>Spin Tuan Rumah Selanjutnya</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={resetSpin}
                          disabled={submitting}
                          className="flex-1 px-4 md:px-6 py-3 md:py-4 border-2 rounded-xl md:rounded-2xl backdrop-blur-xl transition-all disabled:opacity-50 text-white font-bold text-base md:text-lg"
                          style={{
                            borderColor: 'rgba(255,255,255,0.3)',
                            background: 'rgba(255,255,255,0.1)',
                            boxShadow: '0 10px 30px rgba(0,0,0,0.3), inset 0 1px 10px rgba(255,255,255,0.2)'
                          }}
                        >
                          Spin Lagi
                        </button>
                        <button
                          onClick={() => setShowConfirmModal(true)}
                          disabled={submitting}
                          className="flex-1 px-4 md:px-6 py-3 md:py-4 backdrop-blur-xl text-white rounded-xl md:rounded-2xl font-bold text-base md:text-lg transition-all disabled:opacity-50 border-2"
                          style={{
                            background: 'linear-gradient(135deg, rgba(147,51,234,0.6) 0%, rgba(79,70,229,0.6) 100%)',
                            borderColor: 'rgba(255,255,255,0.3)',
                            boxShadow: '0 20px 50px rgba(147,51,234,0.5), inset 0 1px 20px rgba(255,255,255,0.2)'
                          }}
                        >
                          Konfirmasi
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && selectedMember && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Konfirmasi Hasil Undian</h3>
              <p className="text-gray-600 mb-4">
                Kumpulan bulan depan akan diadakan di rumah:
              </p>
              <p className="text-3xl font-bold text-green-600 mb-4">{selectedMember.name}</p>
              <p className="text-sm text-gray-500">
                Data akan otomatis ditambahkan ke daftar acara kumpulan
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                disabled={submitting}
                className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-xl hover:bg-gray-50 transition-all disabled:opacity-50 text-gray-700 font-semibold"
              >
                Batal
              </button>
              <button
                onClick={confirmSpinResult}
                disabled={submitting}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  'Ya, Konfirmasi'
                )}
              </button>
            </div>
          </div>
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

      {/* Edit Meeting Modal */}
      {showEditModal && editingMeeting && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl p-8 max-w-lg w-full shadow-2xl border border-white/20 max-h-[90vh] overflow-y-auto animate-slide-up">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl">
                  <CalendarDays className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Edit Acara Kumpulan</h2>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm text-gray-700 font-semibold flex items-center gap-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  Tanggal Acara
                </label>
                <input
                  type="date"
                  value={editFormData.date}
                  onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
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
                    value={editFormData.location}
                    onChange={(e) => setEditFormData({ ...editFormData, location: e.target.value })}
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
                    value={editFormData.total_cash_collected}
                    onChange={(e) => setEditFormData({ ...editFormData, total_cash_collected: e.target.value })}
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
                  value={editFormData.topic}
                  onChange={(e) => setEditFormData({ ...editFormData, topic: e.target.value })}
                  placeholder="Misal: Membahas agenda tahun baru"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all bg-white hover:border-gray-300"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-gray-700 font-semibold flex items-center gap-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  Catatan (Opsional)
                </label>
                <textarea
                  value={editFormData.notes}
                  onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                  placeholder="Catatan tambahan tentang acara..."
                  rows={4}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none transition-all bg-white hover:border-gray-300"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowEditModal(false)}
                  disabled={submitting}
                  className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-xl hover:bg-gray-50 transition-all disabled:opacity-50 text-gray-700 font-semibold hover:border-gray-400 active:scale-95"
                >
                  Batal
                </button>
                <button
                  onClick={updateMeeting}
                  disabled={submitting || !editFormData.topic.trim()}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-white font-semibold shadow-lg hover:shadow-xl active:scale-95"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    'Perbarui'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl animate-slide-up">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Hapus Acara?</h3>
              <p className="text-gray-600">
                Yakin ingin menghapus acara ini? Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setDeletingMeetingId(null)
                }}
                disabled={submitting}
                className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-xl hover:bg-gray-50 transition-all disabled:opacity-50 text-gray-700 font-semibold"
              >
                Batal
              </button>
              <button
                onClick={deleteMeeting}
                disabled={submitting}
                className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Menghapus...
                  </>
                ) : (
                  'Ya, Hapus'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-4 right-4 z-[100] animate-slide-up">
          <div className="bg-white/90 backdrop-blur-xl text-gray-900 px-6 py-4 rounded-xl shadow-2xl border border-gray-200 flex items-center gap-3">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <p className="font-semibold">{toastMessage}</p>
          </div>
        </div>
      )}
    </div>
  )
}
