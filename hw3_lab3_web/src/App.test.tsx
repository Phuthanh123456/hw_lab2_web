import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App, RESERVATION_TTL_MS } from './App'

let frameId = 0
let pendingFrames: Map<number, FrameRequestCallback>

beforeEach(() => {
  frameId = 0
  pendingFrames = new Map()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-11T11:00:00.000Z'))
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    const id = ++frameId
    pendingFrames.set(id, callback)
    return id
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    pendingFrames.delete(id)
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('11.11 flash-sale demo', () => {
  it('renders the sale, millisecond countdown and starting stock', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Midday Flash Sale' })).toBeTruthy()
    expect(screen.getByLabelText('Thời gian còn lại đến đợt sale').textContent).toBe(
      '00:05:00.000',
    )
    expect(screen.getByText('Tồn ban đầu').parentElement?.textContent).toContain('4')
    expect(screen.getByText('Còn trong kho').parentElement?.textContent).toContain('4')
  })

  it('refreshes the visible countdown from the injected absolute-time scheduler', () => {
    render(<App />)
    const nextFrame = pendingFrames.entries().next().value
    expect(nextFrame).toBeDefined()
    if (!nextFrame) throw new Error('countdown did not schedule a frame')

    act(() => {
      vi.setSystemTime(new Date(Date.now() + 321))
      nextFrame[1](16)
    })

    expect(screen.getByLabelText('Thời gian còn lại đến đợt sale').textContent).toBe(
      '00:04:59.679',
    )
  })

  it('runs reserve then checkout and preserves the reserved stock after checkout', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Giữ 1 sản phẩm' }))
    expect(screen.getByText('Đang giữ')).toBeTruthy()
    expect(screen.getByRole('status').textContent).toContain('Đã giữ 1 sản phẩm')

    fireEvent.click(screen.getByRole('button', { name: /Checkout reservation/ }))

    expect(screen.getByText('Đã checkout')).toBeTruthy()
    expect(screen.getByRole('status').textContent).toContain('Checkout thành công')
    expect(screen.getByText('Còn trong kho').parentElement?.textContent).toContain('3')
  })

  it('expires a reservation on its deadline and restores stock', async () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Giữ 1 sản phẩm' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RESERVATION_TTL_MS)
    })

    expect(screen.getByText('Đã hết hạn')).toBeTruthy()
    expect(screen.getByRole('status').textContent).toContain('đã hết hạn')
    expect(screen.getByText('Còn trong kho').parentElement?.textContent).toContain('4')
  })

  it('announces when the available stock is exhausted', () => {
    render(<App />)
    const reserveButton = screen.getByRole('button', { name: 'Giữ 1 sản phẩm' })

    for (let index = 0; index < 4; index += 1) fireEvent.click(reserveButton)

    expect(reserveButton).toHaveProperty('disabled', true)
    expect(screen.getByRole('status').textContent).toContain('không còn hàng khả dụng')
    expect(screen.getByText('Còn trong kho').parentElement?.textContent).toContain('0')
  })

  it('announces a checkout rejection if it runs at the expiry deadline before the UI timeout', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Giữ 1 sản phẩm' }))
    vi.setSystemTime(new Date(Date.now() + RESERVATION_TTL_MS))

    fireEvent.click(screen.getByRole('button', { name: /Checkout reservation/ }))

    expect(screen.getByRole('status').textContent).toContain('Checkout bị từ chối')
    expect(screen.getByText('Đã hết hạn')).toBeTruthy()
    expect(screen.getByText('Còn trong kho').parentElement?.textContent).toContain('4')
  })

  it('resets stock, reservations and countdown for another demo run', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Giữ 1 sản phẩm' }))
    fireEvent.click(screen.getByRole('button', { name: 'Khởi động lại demo' }))

    expect(screen.getByText('Chưa có reservation. Giữ một sản phẩm để bắt đầu.')).toBeTruthy()
    expect(screen.getByText('Còn trong kho').parentElement?.textContent).toContain('4')
    expect(screen.getByRole('status').textContent).toContain('đã được khởi động lại')
  })

  it('cleans the countdown frame and reservation expiry timeout on unmount', () => {
    const { unmount } = render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Giữ 1 sản phẩm' }))

    expect(pendingFrames.size).toBe(1)
    expect(vi.getTimerCount()).toBe(1)

    unmount()

    expect(pendingFrames.size).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })
})
