export default function BookingSteps() {
  const steps = [
    {
      n: "01", color: "text-red-400 border-red-500/30 bg-red-500/10",
      title: "Agissez MAINTENANT",
      desc: "Les erreurs tarifaires disparaissent en quelques heures. N'attendez pas de confirmer avec vos proches — réservez d'abord, discutez ensuite.",
    },
    {
      n: "02", color: "text-amber-400 border-amber-500/30 bg-amber-500/10",
      title: "Réservez en direct",
      desc: "Toujours réserver sur le site officiel de la compagnie, pas via un OTA. Les compagnies ont plus de chances d'honorer si vous avez une réservation directe.",
    },
    {
      n: "03", color: "text-sky-400 border-sky-500/30 bg-sky-500/10",
      title: "Faites des captures d'écran",
      desc: "Capturez confirmation, prix affiché et email de confirmation. Ces preuves sont essentielles si la compagnie tente d'annuler.",
    },
    {
      n: "04", color: "text-purple-400 border-purple-500/30 bg-purple-500/10",
      title: "N'achetez pas les extras",
      desc: "Ne payez pas de sièges, bagages supplémentaires ou services avant confirmation de l'erreur. Attendez 48-72h pour être certain que le vol est honoré.",
    },
    {
      n: "05", color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
      title: "Vérifiez régulièrement",
      desc: "Surveillez votre email. La compagnie a 72h légalement pour annuler (dans certains pays). Passé ce délai, le vol doit être honoré.",
    },
  ];

  return (
    <div className="space-y-3">
      {steps.map((s) => (
        <div key={s.n} className="flex gap-3 glass rounded-xl p-4">
          <div className={`w-8 h-8 rounded-lg border flex items-center justify-center text-xs font-black mono shrink-0 ${s.color}`}>
            {s.n}
          </div>
          <div>
            <div className="text-sm font-semibold text-white mb-0.5">{s.title}</div>
            <div className="text-xs text-white/50 leading-relaxed">{s.desc}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
