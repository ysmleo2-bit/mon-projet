"""
Agent Comparateur de Prix — Vols & Hôtels
==========================================

Utilise Claude Opus 4.6 avec adaptive thinking + Playwright MCP
pour scraper les prix en temps réel et trouver les meilleures offres.

Usage :
  python price_comparison_agent.py
  python price_comparison_agent.py --from "Paris" --to "Tokyo" --depart "2026-05-01" --retour "2026-05-10" --voyageurs 2
"""

import argparse
import asyncio
import sys
from datetime import datetime, timedelta

from claude_agent_sdk import query, ClaudeAgentOptions, ResultMessage, SystemMessage


SYSTEM_PROMPT = """Tu es un expert comparateur de prix pour les voyages. Tu scrapes les meilleurs sites de comparaison de vols et d'hôtels pour trouver les offres les plus avantageuses.

Pour chaque recherche tu dois :

1. **VOLS** — Scraper ces sites dans l'ordre :
   - Google Flights (google.com/travel/flights)
   - Kayak (kayak.fr)
   - Skyscanner (skyscanner.fr)
   - Momondo (momondo.fr)

2. **HÔTELS** — Scraper ces sites :
   - Booking.com
   - Hotels.com
   - Trivago (trivago.fr)
   - Airbnb (airbnb.fr) pour les appartements

Pour chaque site, tu dois :
- Naviguer jusqu'à la page de recherche
- Remplir les champs (destination, dates, voyageurs)
- Attendre le chargement des résultats
- Extraire les 5 meilleures offres (prix, durée, escales pour les vols / note, localisation pour les hôtels)

À la fin, présente un récapitulatif clair avec :
- 🏆 TOP 3 VOLS : prix, compagnie, durée, escales, lien direct
- 🏆 TOP 3 HÔTELS : prix/nuit, nom, note, localisation, lien direct
- 💡 MEILLEURE COMBINAISON vol + hôtel avec le budget total

Formate ta réponse en markdown avec des tableaux comparatifs clairs.
Indique toujours la date et l'heure de la recherche pour que les prix soient vérifiables.
"""


def parse_args():
    parser = argparse.ArgumentParser(
        description="Agent comparateur de prix vols & hôtels"
    )
    parser.add_argument("--from", dest="origin", default=None, help="Ville de départ")
    parser.add_argument("--to", dest="destination", default=None, help="Destination")
    parser.add_argument("--depart", default=None, help="Date de départ (YYYY-MM-DD)")
    parser.add_argument("--retour", default=None, help="Date de retour (YYYY-MM-DD)")
    parser.add_argument("--voyageurs", type=int, default=1, help="Nombre de voyageurs")
    parser.add_argument("--hotel-only", action="store_true", help="Rechercher seulement les hôtels")
    parser.add_argument("--vol-only", action="store_true", help="Rechercher seulement les vols")
    parser.add_argument("--budget-max", type=float, default=None, help="Budget maximum en euros")
    return parser.parse_args()


def build_prompt(args) -> str:
    now = datetime.now().strftime("%d/%m/%Y à %H:%M")

    # Interactive mode if missing args
    if not args.destination:
        print("\n🌍 Agent Comparateur de Prix — Vols & Hôtels")
        print("=" * 50)
        args.origin = input("🛫 Ville de départ (ex: Paris) : ").strip() or "Paris"
        args.destination = input("🛬 Destination (ex: Tokyo) : ").strip()
        if not args.destination:
            print("❌ La destination est obligatoire.")
            sys.exit(1)

        default_depart = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
        default_retour = (datetime.now() + timedelta(days=37)).strftime("%Y-%m-%d")
        depart_input = input(f"📅 Date de départ (YYYY-MM-DD) [{default_depart}] : ").strip()
        args.depart = depart_input or default_depart
        retour_input = input(f"📅 Date de retour (YYYY-MM-DD) [{default_retour}] : ").strip()
        args.retour = retour_input or default_retour
        voyageurs_input = input("👥 Nombre de voyageurs [1] : ").strip()
        args.voyageurs = int(voyageurs_input) if voyageurs_input.isdigit() else 1
        budget_input = input("💶 Budget maximum en euros (laisser vide = sans limite) : ").strip()
        args.budget_max = float(budget_input) if budget_input else None

        mode_input = input("🔎 Chercher : [1] Vols + Hôtels (défaut), [2] Vols seulement, [3] Hôtels seulement : ").strip()
        args.vol_only = mode_input == "2"
        args.hotel_only = mode_input == "3"

    origin = getattr(args, "origin", None) or "Paris"
    destination = args.destination
    depart = args.depart or (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
    retour = args.retour or (datetime.now() + timedelta(days=37)).strftime("%Y-%m-%d")
    voyageurs = args.voyageurs
    budget_max = args.budget_max

    # Format dates for display
    try:
        depart_fmt = datetime.strptime(depart, "%Y-%m-%d").strftime("%d %B %Y")
        retour_fmt = datetime.strptime(retour, "%Y-%m-%d").strftime("%d %B %Y")
        nb_nuits = (datetime.strptime(retour, "%Y-%m-%d") - datetime.strptime(depart, "%Y-%m-%d")).days
    except ValueError:
        depart_fmt = depart
        retour_fmt = retour
        nb_nuits = 7

    budget_clause = f"\n- Budget maximum : {budget_max}€ par personne" if budget_max else ""
    mode_clause = ""
    if args.vol_only:
        mode_clause = "\n\nIMPORTANT : Chercher UNIQUEMENT les vols, pas les hôtels."
    elif args.hotel_only:
        mode_clause = "\n\nIMPORTANT : Chercher UNIQUEMENT les hôtels, pas les vols."

    prompt = f"""Recherche effectuée le {now}.

## Paramètres de recherche :
- Départ : {origin}
- Destination : {destination}
- Date aller : {depart_fmt} ({depart})
- Date retour : {retour_fmt} ({retour})
- Durée : {nb_nuits} nuits
- Voyageurs : {voyageurs} personne(s){budget_clause}{mode_clause}

Lance maintenant la recherche complète sur tous les sites de comparaison.
Pour chaque site, navigue réellement sur le web, remplis le formulaire de recherche avec ces paramètres exacts, et extrait les résultats.

Commence par les vols sur Google Flights, puis Kayak, puis Skyscanner.
Ensuite cherche les hôtels sur Booking.com, puis Hotels.com, puis Trivago.

Présente les résultats dans un tableau comparatif clair avec les meilleurs prix trouvés."""

    return prompt


async def run_agent(prompt: str):
    print("\n🔍 Démarrage de l'agent de comparaison de prix...")
    print("⏳ Scraping des sites en cours (cela peut prendre quelques minutes)...\n")
    print("-" * 60)

    full_result = ""
    session_id = None

    async for message in query(
        prompt=prompt,
        options=ClaudeAgentOptions(
            model="claude-opus-4-6",
            system_prompt=SYSTEM_PROMPT,
            allowed_tools=["WebSearch", "WebFetch", "Bash"],
            mcp_servers={
                "playwright": {
                    "command": "npx",
                    "args": ["@playwright/mcp@latest", "--headless"]
                }
            },
            permission_mode="bypassPermissions",
            max_turns=50,
            thinking={"type": "adaptive"},
        )
    ):
        if isinstance(message, SystemMessage) and message.subtype == "init":
            session_id = message.data.get("session_id")
        elif isinstance(message, ResultMessage):
            full_result = message.result

    print("-" * 60)
    print("\n✅ Recherche terminée !\n")

    if full_result:
        print(full_result)
    else:
        print("⚠️  Aucun résultat retourné par l'agent.")

    if session_id:
        print(f"\n📋 Session ID : {session_id}")
        print("💡 Vous pouvez relancer avec ce session ID pour affiner la recherche.")

    return full_result


def main():
    args = parse_args()
    prompt = build_prompt(args)

    print("\n" + "=" * 60)
    print("  🌐 COMPARATEUR DE PRIX VOLS & HÔTELS")
    print("=" * 60)

    try:
        asyncio.run(run_agent(prompt))
    except KeyboardInterrupt:
        print("\n\n⛔ Recherche interrompue par l'utilisateur.")
        sys.exit(0)
    except Exception as e:
        print(f"\n❌ Erreur : {e}")
        print("\n💡 Vérifiez que claude-agent-sdk est installé :")
        print("   pip install claude-agent-sdk")
        print("   npx @playwright/mcp@latest --version")
        sys.exit(1)


if __name__ == "__main__":
    main()
