# AutoCare Android — APK gratuit prin Trusted Web Activity

AutoCare este deja un PWA la https://autocare-garaj.vercel.app/ și poate fi instalată gratuit pe Android și iOS din pagina https://autocare-garaj.vercel.app/instaleaza .

## APK Android (opțional)

Pentru un APK Android distribuit direct, fără Play Store, folosește **Bubblewrap** (open source) pe un PC cu Node.js și JDK/Android SDK.

1. Instalează Node.js LTS și JDK 17 sau versiunea compatibilă cu Bubblewrap.
2. Rulează `npm install -g @bubblewrap/cli`.
3. Într-un director separat rulează `bubblewrap init --manifest https://autocare-garaj.vercel.app/manifest.webmanifest`.
4. Configurează numele **AutoCare**, package ID stabil (de exemplu `ro.autocare.garaj`) și generează o cheie de semnare locală; păstrează cheia în siguranță, **nu o încărca pe GitHub**.
5. Rulează `bubblewrap build`. Instrumentul poate solicita instalarea componentelor Android SDK. APK-ul rezultat se poate instala pe Android.
6. Pentru afișare TWA verificată, publică `https://autocare-garaj.vercel.app/.well-known/assetlinks.json` cu fingerprintul SHA-256 al certificatului de semnare și package ID-ul exact. Fără Digital Asset Links verificat, Chrome poate afișa bara browserului.

**Important:** APK-ul Android nu funcționează pe iPhone. Pentru iPhone folosește instalarea PWA din Safari, gratuit. Nu există o cale echivalentă universală de instalare gratuită a unui IPA nativ pe toate iPhone-urile.

## Validări înainte de distribuire

- Autentificare și deconectare
- Adăugare vehicul, documente și remindere
- Centrul de suport și câmpul de scriere
- Notificări Push pe Android și iOS (acolo unde sunt permise)
- Navigație fără overflow pe telefoane mici

Acest director conține instrucțiunile de build, **nu un APK deja compilat**. Un APK real necesită Android SDK și o cheie de semnare.
