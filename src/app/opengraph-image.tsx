import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'myUNO — Serviced living in Phuket';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0E4F4B 0%, #0A3733 100%)',
          color: '#F5EFE4',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ fontSize: 96, fontWeight: 700, display: 'flex' }}>
          my<span style={{ color: '#D69A3A' }}>UNO</span>
        </div>
        <div style={{ fontSize: 36, marginTop: 24, opacity: 0.9, display: 'flex' }}>
          Serviced living in Phuket — stay, live, own
        </div>
      </div>
    ),
    size
  );
}
