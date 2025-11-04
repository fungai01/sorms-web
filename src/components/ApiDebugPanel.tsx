'use client'

import { useState, useEffect } from 'react'
import { API_CONFIG } from '@/lib/config'

/**
 * API Debug Panel - Hiển thị thông tin debug về API configuration
 * Chỉ hiển thị trong development mode hoặc khi có query param ?debug=true
 */
export function ApiDebugPanel() {
  const [isVisible, setIsVisible] = useState(false)
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>('checking')
  const [lastCheck, setLastCheck] = useState<Date | null>(null)

  useEffect(() => {
    // Chỉ hiển thị nếu:
    // 1. Development mode
    // 2. Hoặc có query param ?debug=true
    const isDev = process.env.NODE_ENV === 'development'
    const hasDebugParam = typeof window !== 'undefined' && 
                          new URLSearchParams(window.location.search).get('debug') === 'true'
    
    setIsVisible(isDev || hasDebugParam)
  }, [])

  useEffect(() => {
    if (!isVisible) return

    // Check API status
    const checkApiStatus = async () => {
      try {
        const response = await fetch(`${API_CONFIG.BASE_URL}/rooms`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        })
        setApiStatus(response.ok ? 'online' : 'offline')
        setLastCheck(new Date())
      } catch (error) {
        setApiStatus('offline')
        setLastCheck(new Date())
      }
    }

    checkApiStatus()
    const interval = setInterval(checkApiStatus, 30000) // Check every 30s

    return () => clearInterval(interval)
  }, [isVisible])

  if (!isVisible) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-gray-900 text-white p-4 rounded-lg shadow-2xl max-w-md text-xs font-mono">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-sm">🔧 API Debug Panel</h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-400 hover:text-white"
        >
          ✕
        </button>
      </div>

      <div className="space-y-2">
        {/* API Status */}
        <div className="flex items-center gap-2">
          <span className="text-gray-400">Status:</span>
          <span className={`font-semibold ${
            apiStatus === 'online' ? 'text-green-400' :
            apiStatus === 'offline' ? 'text-red-400' :
            'text-yellow-400'
          }`}>
            {apiStatus === 'online' ? '🟢 Online' :
             apiStatus === 'offline' ? '🔴 Offline' :
             '🟡 Checking...'}
          </span>
        </div>

        {/* Last Check */}
        {lastCheck && (
          <div className="flex items-center gap-2">
            <span className="text-gray-400">Last Check:</span>
            <span className="text-blue-400">{lastCheck.toLocaleTimeString()}</span>
          </div>
        )}

        {/* Base URL */}
        <div className="border-t border-gray-700 pt-2 mt-2">
          <div className="text-gray-400 mb-1">Base URL:</div>
          <div className="bg-gray-800 p-2 rounded break-all text-green-400">
            {API_CONFIG.BASE_URL}
          </div>
        </div>

        {/* Environment */}
        <div className="flex items-center gap-2">
          <span className="text-gray-400">Environment:</span>
          <span className="text-purple-400">{process.env.NODE_ENV}</span>
        </div>

        {/* Timeout */}
        <div className="flex items-center gap-2">
          <span className="text-gray-400">Timeout:</span>
          <span className="text-orange-400">{API_CONFIG.TIMEOUT}ms</span>
        </div>

        {/* Environment Variables */}
        <div className="border-t border-gray-700 pt-2 mt-2">
          <div className="text-gray-400 mb-1">Env Vars:</div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-gray-500">NEXT_PUBLIC_API_BASE_URL:</span>
              <span className={process.env.NEXT_PUBLIC_API_BASE_URL ? 'text-green-400' : 'text-red-400'}>
                {process.env.NEXT_PUBLIC_API_BASE_URL || '❌ Not Set'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">NEXT_PUBLIC_API_URL:</span>
              <span className={process.env.NEXT_PUBLIC_API_URL ? 'text-green-400' : 'text-gray-600'}>
                {process.env.NEXT_PUBLIC_API_URL || '(not set)'}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="border-t border-gray-700 pt-2 mt-2">
          <div className="text-gray-400 mb-1">Quick Actions:</div>
          <div className="flex gap-2">
            <button
              onClick={() => window.location.reload()}
              className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-white text-xs"
            >
              🔄 Reload
            </button>
            <button
              onClick={() => {
                console.log('API Configuration:', {
                  BASE_URL: API_CONFIG.BASE_URL,
                  TIMEOUT: API_CONFIG.TIMEOUT,
                  ENDPOINTS: API_CONFIG.ENDPOINTS,
                  ENV_VARS: {
                    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
                    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
                    NODE_ENV: process.env.NODE_ENV
                  }
                })
                alert('Check console for full API configuration')
              }}
              className="px-2 py-1 bg-purple-600 hover:bg-purple-700 rounded text-white text-xs"
            >
              📋 Log Config
            </button>
          </div>
        </div>

        {/* Help Text */}
        <div className="border-t border-gray-700 pt-2 mt-2 text-gray-500 text-[10px]">
          💡 Tip: Add ?debug=true to URL to show this panel in production
        </div>
      </div>
    </div>
  )
}

