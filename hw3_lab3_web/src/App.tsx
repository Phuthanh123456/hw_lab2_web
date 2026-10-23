import { useEffect, useRef, useState } from 'react'
import { InventoryCoordinator } from './inventory/inventory-coordinator'
import type { Reservation, ReservationStatus } from './inventory/reservation'
import { startCountdown } from './timer/countdown-scheduler'
import './App.css'

const PRODUCT_ID = 'anc-headphones'
const INITIAL_STOCK = 4
const SALE_COUNTDOWN_MS = 5 * 60 * 1_000
export const RESERVATION_TTL_MS = 12 * 1_000

const statusLabels: Record<ReservationStatus, string> = {
  active: 'Đang giữ',
  'checked-out': 'Đã checkout',
  expired: 'Đã hết hạn',
}

function createDemoCoordinator(): InventoryCoordinator {
  return new InventoryCoordinator(
    [{ productId: PRODUCT_ID, quantity: INITIAL_STOCK }],
    { reservationTtlMs: RESERVATION_TTL_MS },
  )
}

function formatCountdown(remainingMs: number): string {
  const totalMs = Math.max(0, Math.floor(remainingMs))
  const hours = Math.floor(totalMs / 3_600_000)
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000)
  const seconds = Math.floor((totalMs % 60_000) / 1_000)
  const milliseconds = totalMs % 1_000

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`
}

function formatExpiry(expiresAt: number): string {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(expiresAt)
}

export function App() {
  const coordinatorRef = useRef<InventoryCoordinator | null>(null)
  if (coordinatorRef.current === null) coordinatorRef.current = createDemoCoordinator()

  const countdownRef = useRef<HTMLSpanElement>(null)
  const expiryTimersRef = useRef(new Map<string, number>())
  const [availableStock, setAvailableStock] = useState(INITIAL_STOCK)
  const [reservations, setReservations] = useState<readonly Reservation[]>([])
  const [announcement, setAnnouncement] = useState(
    'Demo đã sẵn sàng. Mỗi lần giữ hàng tạo reservation có thời hạn 12 giây.',
  )
  const [saleStarted, setSaleStarted] = useState(false)
  const [countdownVersion, setCountdownVersion] = useState(0)

  const syncFromCoordinator = () => {
    const coordinator = coordinatorRef.current
    if (!coordinator) return

    const nextReservations = coordinator.listReservations()
    setReservations(nextReservations)
    setAvailableStock(coordinator.getAvailableStock(PRODUCT_ID) ?? 0)

    for (const [reservationId, timerId] of expiryTimersRef.current) {
      if (coordinator.getReservation(reservationId)?.status !== 'active') {
        window.clearTimeout(timerId)
        expiryTimersRef.current.delete(reservationId)
      }
    }
  }

  useEffect(() => {
    const stopCountdown = startCountdown(
      SALE_COUNTDOWN_MS,
      (remainingMs) => {
        if (countdownRef.current) countdownRef.current.textContent = formatCountdown(remainingMs)
      },
      () => setSaleStarted(true),
    )

    return stopCountdown
  }, [countdownVersion])

  useEffect(
    () => () => {
      for (const timerId of expiryTimersRef.current.values()) window.clearTimeout(timerId)
      expiryTimersRef.current.clear()
    },
    [],
  )

  const scheduleExpiry = (reservation: Reservation) => {
    const delayMs = Math.max(0, reservation.expiresAt - Date.now())
    const timerId = window.setTimeout(() => {
      expiryTimersRef.current.delete(reservation.id)
      const expired = coordinatorRef.current?.expireDueReservations() ?? []
      syncFromCoordinator()

      if (expired.some((item) => item.id === reservation.id)) {
        setAnnouncement(
          `Reservation ${reservation.id} đã hết hạn. Số lượng hàng đã được trả lại kho.`,
        )
      }
    }, delayMs)

    expiryTimersRef.current.set(reservation.id, timerId)
  }

  const handleReserve = () => {
    const coordinator = coordinatorRef.current
    if (!coordinator) return
    const result = coordinator.reserve(PRODUCT_ID, 1)

    syncFromCoordinator()
    if (result.ok) {
      scheduleExpiry(result.reservation)
      const noStockLeft = coordinator.getAvailableStock(PRODUCT_ID) === 0
      setAnnouncement(
        `Đã giữ 1 sản phẩm. Reservation ${result.reservation.id} hết hạn lúc ${formatExpiry(result.reservation.expiresAt)}.${noStockLeft ? ' Hiện không còn hàng khả dụng; khởi động lại demo hoặc chờ lock hết hạn để thử tiếp.' : ''}`,
      )
      return
    }

    if (result.reason === 'out-of-stock') {
      setAnnouncement('Đã hết hàng. Hãy khởi động lại demo để thử lại.')
    } else if (result.reason === 'product-not-found') {
      setAnnouncement('Không tìm thấy sản phẩm trong đợt sale mô phỏng.')
    } else {
      setAnnouncement('Số lượng reserve không hợp lệ.')
    }
  }

  const handleCheckout = (reservationId: string) => {
    const coordinator = coordinatorRef.current
    if (!coordinator) return
    const result = coordinator.checkout(reservationId)

    syncFromCoordinator()
    if (result.ok) {
      const noStockLeft = coordinator.getAvailableStock(PRODUCT_ID) === 0
      setAnnouncement(
        `Checkout thành công cho reservation ${reservationId}.${noStockLeft ? ' Hiện không còn hàng khả dụng.' : ''}`,
      )
    } else if (result.reason === 'reservation-expired') {
      setAnnouncement(`Checkout bị từ chối: reservation ${reservationId} đã hết hạn.`)
    } else if (result.reason === 'already-checked-out') {
      setAnnouncement(`Checkout bị từ chối: reservation ${reservationId} đã được checkout.`)
    } else {
      setAnnouncement('Checkout bị từ chối: không tìm thấy reservation.')
    }
  }

  const restartDemo = () => {
    for (const timerId of expiryTimersRef.current.values()) window.clearTimeout(timerId)
    expiryTimersRef.current.clear()
    coordinatorRef.current = createDemoCoordinator()
    setAvailableStock(INITIAL_STOCK)
    setReservations([])
    setSaleStarted(false)
    setCountdownVersion((version) => version + 1)
    setAnnouncement('Demo đã được khởi động lại. Tồn kho và countdown đã đặt lại.')
  }

  return (
    <main className="page-shell">
      <header className="page-header">
        <p className="eyebrow">MÔ PHỎNG MEGA-SALE VIỆT NAM · 11.11</p>
        <h1>Midday Flash Sale</h1>
        <p className="intro">
          Mô phỏng giữ hàng có thời hạn và checkout cho một sản phẩm trong đợt sale 11.11.
        </p>
      </header>

      <section className="countdown-panel" aria-labelledby="countdown-heading">
        <div>
          <p className="section-kicker">ĐỢT SALE MÔ PHỎNG</p>
          <h2 id="countdown-heading">{saleStarted ? 'Sale đang diễn ra' : 'Bắt đầu sau'}</h2>
        </div>
        <span
          ref={countdownRef}
          className="countdown-value"
          aria-label="Thời gian còn lại đến đợt sale"
        >
          05:00:00.000
        </span>
      </section>

      <section className="sale-layout" aria-label="Sản phẩm và reservation của đợt sale">
        <article className="product-card" aria-labelledby="product-heading">
          <div className="product-topline">
            <span className="product-tag">11.11 · Ưu đãi giới hạn</span>
            <span className="product-symbol" aria-hidden="true">ANC</span>
          </div>
          <h2 id="product-heading">Tai nghe chống ồn không dây</h2>
          <p className="product-description">
            Sản phẩm demo để kiểm tra tồn kho, lock reservation và checkout.
          </p>
          <p className="product-price">1.111.000 ₫</p>

          <dl className="stock-summary">
            <div>
              <dt>Tồn ban đầu</dt>
              <dd>{INITIAL_STOCK}</dd>
            </div>
            <div>
              <dt>Còn trong kho</dt>
              <dd>{availableStock}</dd>
            </div>
            <div>
              <dt>Đang hiển thị</dt>
              <dd>{reservations.length}</dd>
            </div>
          </dl>

          <button
            className="button button-primary reserve-button"
            type="button"
            onClick={handleReserve}
            disabled={availableStock < 1}
          >
            Giữ 1 sản phẩm
          </button>
        </article>

        <section className="reservations-panel" aria-labelledby="reservations-heading">
          <div className="section-heading">
            <div>
              <p className="section-kicker">LOCK THEO THỜI HẠN</p>
              <h2 id="reservations-heading">Reservation</h2>
            </div>
            <button className="button button-secondary" type="button" onClick={restartDemo}>
              Khởi động lại demo
            </button>
          </div>

          {reservations.length === 0 ? (
            <p className="empty-state">Chưa có reservation. Giữ một sản phẩm để bắt đầu.</p>
          ) : (
            <ul className="reservation-list" aria-label="Danh sách reservation">
              {reservations.map((reservation) => (
                <li className="reservation-card" key={reservation.id}>
                  <div className="reservation-title-row">
                    <code>{reservation.id}</code>
                    <span className={`status-badge status-${reservation.status}`}>
                      {statusLabels[reservation.status]}
                    </span>
                  </div>
                  <p className="reservation-meta">
                    {reservation.quantity} sản phẩm · hết hạn lúc {formatExpiry(reservation.expiresAt)}
                  </p>
                  {reservation.status === 'active' && (
                    <button
                      className="button button-checkout"
                      type="button"
                      aria-label={`Checkout reservation ${reservation.id}`}
                      onClick={() => handleCheckout(reservation.id)}
                    >
                      Xác nhận mua
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </section>

      <p className="announcement" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
    </main>
  )
}
