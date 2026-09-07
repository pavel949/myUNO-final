import React from 'react'

export const BookingWidget: React.FC<{ service: any }> = ({ service }) => {
  const [from, setFrom] = React.useState('')
  const [to, setTo] = React.useState('')

  async function handleBook() {
    const res = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ _op: 'book', payload: { serviceId: service.id, buyerId: 'demo-buyer', providerId: service.providerId, scheduledFrom: from, scheduledTo: to, totalCents: service.priceCents, currency: service.currency } }) })
    const json = await res.json()
    if (json.ok) alert('Booking created: ' + json.order.id)
    else alert('Booking failed: ' + JSON.stringify(json))
  }

  return (
    <div className="booking-widget">
      <label>From<input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
      <label>To<input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} /></label>
      <button onClick={handleBook}>Book now</button>
    </div>
  )
}
