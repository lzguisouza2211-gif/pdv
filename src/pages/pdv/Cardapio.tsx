const WHATSAPP_NUMBER = '5535999876408'
const WHATSAPP_MESSAGE = 'Olá! Vim pelo site e quero fazer um pedido 🍔'
const WHATSAPP_LINK = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`

export function Cardapio() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #1E293B 0%, #11182A 70%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 24, textAlign: 'center',
    }}>
      <div style={{
        width: 88, height: 88, borderRadius: 999, background: '#fff',
        boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', marginBottom: 20,
      }}>
        <img src="/icon.png" alt="Logo" style={{ width: 88, height: 88, objectFit: 'cover', borderRadius: 999 }} />
      </div>

      <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 800, margin: '0 0 8px' }}>
        Luizão Lanches
      </h1>

      <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 15, maxWidth: 320, lineHeight: 1.5, margin: '0 0 28px' }}>
        Hoje os pedidos são feitos direto pelo WhatsApp. Clique no botão abaixo para falar com a gente!
      </p>

      <a
        href={WHATSAPP_LINK}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: '#25D366', color: '#fff', fontWeight: 800, fontSize: 16,
          padding: '14px 28px', borderRadius: 999, textDecoration: 'none',
          boxShadow: '0 8px 24px rgba(37,211,102,0.35)',
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.86 9.86 0 004.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.51 2 12.04 2zm5.8 14.03c-.24.68-1.4 1.3-1.94 1.38-.5.08-1.12.11-1.81-.11-.42-.13-.95-.31-1.64-.6-2.88-1.24-4.76-4.14-4.9-4.33-.14-.19-1.18-1.57-1.18-3 0-1.42.75-2.12 1.02-2.41.27-.29.58-.36.78-.36l.55.01c.18.01.42-.07.65.5.24.58.82 2.01.9 2.15.07.15.12.32.02.51-.1.19-.15.31-.3.48-.15.17-.31.38-.44.51-.15.15-.3.31-.13.61.17.29.75 1.24 1.62 2.01 1.11.99 2.05 1.3 2.34 1.44.29.15.46.13.63-.08.17-.2.72-.84.92-1.13.19-.29.38-.24.65-.14.27.1 1.7.8 1.99.95.29.14.48.22.55.34.07.13.07.75-.17 1.43z"/>
        </svg>
        Pedir pelo WhatsApp
      </a>
    </div>
  )
}
