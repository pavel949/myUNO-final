import React from 'react'

export const Listing: React.FC<{ services?: any[] }> = ({ services = [] }) => {
  return (
    <div className="services-listing">
      {services.map((s: any) => (
        <div key={s.id} className="service-card">
          <h3>{s.titleKey}</h3>
          <p>{s.descriptionKey}</p>
          <div>{(s.priceCents/100).toFixed(2)} {s.currency}</div>
        </div>
      ))}
    </div>
  )
}

export default Listing
