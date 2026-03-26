import Link from 'next/link'
import Navbar from '@/components/Navbar'

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        {/* Hero */}
        <section className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 text-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-24 sm:py-32 text-center">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur px-4 py-2 rounded-full text-sm font-medium mb-8">
              <span className="w-2 h-2 bg-green-400 rounded-full"></span>
              La plateforme de mise en relation n°1
            </div>
            <h1 className="text-4xl sm:text-6xl font-bold leading-tight mb-6">
              Connectez <span className="text-yellow-300">Setters</span><br />
              et <span className="text-yellow-300">Entrepreneurs</span>
            </h1>
            <p className="text-lg sm:text-xl text-indigo-100 max-w-2xl mx-auto mb-10">
              La plateforme simplifiée pour trouver les meilleurs setters ou des entrepreneurs ambitieux. Plus simple que LinkedIn, plus ciblé qu&apos;Upwork.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/auth/register"
                className="bg-white text-indigo-700 hover:bg-indigo-50 font-semibold px-8 py-4 rounded-xl text-lg transition"
              >
                Commencer gratuitement
              </Link>
              <Link
                href="/browse"
                className="bg-white/10 hover:bg-white/20 border border-white/30 text-white font-semibold px-8 py-4 rounded-xl text-lg transition"
              >
                Parcourir les profils
              </Link>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="bg-white border-b border-gray-100">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
            <div className="grid grid-cols-3 gap-8 text-center">
              <div>
                <div className="text-3xl font-bold text-indigo-600">500+</div>
                <div className="text-gray-500 text-sm mt-1">Setters actifs</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-indigo-600">200+</div>
                <div className="text-gray-500 text-sm mt-1">Entrepreneurs</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-indigo-600">1k+</div>
                <div className="text-gray-500 text-sm mt-1">Mises en relation</div>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="py-20 bg-gray-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">Comment ça marche ?</h2>
            <p className="text-gray-500 text-center mb-14">En 3 étapes simples</p>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  step: '01',
                  title: 'Créez votre profil',
                  desc: 'Inscrivez-vous en tant que setter ou entrepreneur et renseignez vos compétences, tarifs et disponibilités.',
                  color: 'bg-indigo-100 text-indigo-600',
                },
                {
                  step: '02',
                  title: 'Découvrez des profils',
                  desc: 'Parcourez les profils filtrés par rôle, compétences ou disponibilité. Trouvez votre match parfait.',
                  color: 'bg-purple-100 text-purple-600',
                },
                {
                  step: '03',
                  title: 'Connectez-vous',
                  desc: 'Envoyez une demande de connexion, échangez des messages et démarrez votre collaboration.',
                  color: 'bg-pink-100 text-pink-600',
                },
              ].map(({ step, title, desc, color }) => (
                <div key={step} className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
                  <div className={`w-12 h-12 ${color} rounded-xl flex items-center justify-center font-bold text-lg mb-6`}>
                    {step}
                  </div>
                  <h3 className="font-bold text-xl text-gray-900 mb-3">{title}</h3>
                  <p className="text-gray-500 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* For setters & entrepreneurs */}
        <section className="py-20 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="grid md:grid-cols-2 gap-12">
              <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-2xl p-10">
                <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center mb-6">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">Vous êtes Setter ?</h3>
                <ul className="space-y-3 text-gray-600 mb-8">
                  {[
                    'Créez un profil professionnel en 5 minutes',
                    'Mettez en avant vos compétences et tarifs',
                    'Recevez des demandes d\'entrepreneurs qualifiés',
                    'Gérez vos collaborations simplement',
                  ].map(item => (
                    <li key={item} className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-indigo-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
                <Link href="/auth/register?role=setter" className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-3 rounded-xl inline-block transition">
                  Rejoindre en tant que Setter
                </Link>
              </div>

              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl p-10">
                <div className="w-12 h-12 bg-purple-600 rounded-xl flex items-center justify-center mb-6">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">Vous êtes Entrepreneur ?</h3>
                <ul className="space-y-3 text-gray-600 mb-8">
                  {[
                    'Trouvez des setters disponibles immédiatement',
                    'Filtrez par compétences et tarif horaire',
                    'Contactez directement les candidats',
                    'Développez votre business rapidement',
                  ].map(item => (
                    <li key={item} className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
                <Link href="/auth/register?role=entrepreneur" className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-6 py-3 rounded-xl inline-block transition">
                  Rejoindre en tant qu&apos;Entrepreneur
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-indigo-600 py-16">
          <div className="max-w-3xl mx-auto px-4 text-center">
            <h2 className="text-3xl font-bold text-white mb-4">Prêt à vous lancer ?</h2>
            <p className="text-indigo-200 mb-8 text-lg">Rejoignez des centaines de setters et d&apos;entrepreneurs déjà sur la plateforme.</p>
            <Link href="/auth/register" className="bg-white text-indigo-700 hover:bg-indigo-50 font-bold px-10 py-4 rounded-xl text-lg transition inline-block">
              Créer mon compte gratuit
            </Link>
          </div>
        </section>
      </main>

      <footer className="bg-gray-900 text-gray-400 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-indigo-600 rounded flex items-center justify-center">
              <span className="text-white text-xs font-bold">SL</span>
            </div>
            <span className="font-semibold text-white">SetterLink</span>
          </div>
          <p className="text-sm">© 2026 SetterLink. Tous droits réservés.</p>
        </div>
      </footer>
    </>
  )
}
