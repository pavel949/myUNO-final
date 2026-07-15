import { Metadata } from 'next';
export const metadata: Metadata = { title: "myUNO", description: "One platform for all your needs." };
export default function Page() {
  return (
    <main className="min-h-screen bg-white">
      <section className="bg-gradient-to-br from-brand-andaman to-brand-andaman-dark text-surface-ivory py-64 px-24">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-heading-1 font-bold mb-24">myUNO</h1>
          <p className="text-body text-surface-ivory/90">One platform for all your needs.</p>
        </div>
      </section>
      <footer className="bg-text-ink text-surface-ivory py-40 px-24"><div className="max-w-6xl mx-auto"><p className="text-small text-surface-ivory/60">© 2026 myUNO.</p></div></footer>
    </main>
  );
}
