export interface SiteTranslation {
  documentTitle: string
  metaDescription: string
  closeDialog: string
  skipToContent: string
  brandLabel: string
  announcement: string
  navigation: { collection: string; personal: string; story: string; contact: string; label: string; open: string; close: string }
  hero: {
    eyebrow: string
    firstLine: string
    secondLine: string
    descriptionBefore: string
    descriptionEmphasis: string
    descriptionAfter: string
    collectionAction: string
    howAction: string
    note: string
    noteStrong: string
    imageLabel: string
    imagePlaceholder: string
    giftLabel: string
    stickerFirst: string
    stickerSecond: string
    stickerTiny: string
    annotation: string
    imageCredit: string
  }
  ribbon: { label: string; phrases: [string, string, string, string] }
  collection: {
    eyebrow: string
    titleFirst: string
    titleSecond: string
    descriptionFirst: string
    descriptionSecond: string
    filterLabel: string
    filters: { all: string; animals: string; seasonal: string }
    designAction: string
    priceQualifier: string
    loading: string
    loadError: string
    retry: string
    emptyTitle: string
    emptyMessage: string
    count: (count: number) => string
    animalLabel: string
    seasonalLabel: string
    closerLook: string
    note: string
  }
  personalize: {
    eyebrow: string
    artLabel: string
    artFirst: string
    artSecond: string
    nameTag: string
    nameTagRecipient: string
    note: string
    titleFirst: string
    titleSecond: string
    description: string
    touches: [string, string, string, string, string, string]
    action: string
    disclaimer: string
  }
  steps: {
    eyebrow: string
    titleFirst: string
    titleSecond: string
    intro: string
    items: [{ title: string; description: string }, { title: string; description: string }, { title: string; description: string }]
  }
  story: {
    eyebrow: string
    imagePlaceholder: string
    titleFirst: string
    titleSecond: string
    paragraphs: [string, string]
    signature: string
  }
  contact: {
    eyebrow: string
    titleFirst: string
    titleSecond: string
    description: string
    instagram: string
    tiktok: string
    demoDisclaimer: string
    modalEyebrow: string
    modalTitle: string
    modalDescription: string
    profilePrompt: string
    messageLabel: string
    genericMessage: string
    messagePrefix: string
    messageSuffix: string
    instagramProfile: string
    tiktokProfile: string
    returnTo: string
  }
  footer: { tagline: string; concept: string }
  details: {
    inspiration: string
    priceDepending: string
    title: string
    contactAction: string
    note: string
  }
}

export const translations: { ro: SiteTranslation } = {
  ro: {
    documentTitle: 'Snuggle Stitches | Detalii mici. Bucurii mari.',
    metaDescription: 'Jucării croșetate cu suflet și cadouri personalizate pentru oamenii dragi. Descoperă universul Snuggle Stitches și imaginează-ți un dar făcut special pentru cineva drag.',
    closeDialog: 'Închide fereastra',
    skipToContent: 'Sari la conținut',
    brandLabel: 'Snuggle Stitches – pagina principală',
    announcement: 'Un strop de bucurie, lucrat manual și dăruit cu drag.',
    navigation: { collection: 'Colecția', personal: 'Pe gustul tău', story: 'Povestea mea', contact: 'Hai să vorbim', label: 'Navigare principală', open: 'Deschide meniul', close: 'Închide meniul' },
    hero: {
      eyebrow: 'CROȘETAT MANUAL, CU MULT DRAG',
      firstLine: 'Detalii mici.',
      secondLine: 'Bucurii mari.',
      descriptionBefore: 'Mici prieteni croșetați și cadouri cu suflet. Un dar făcut puțin mai ',
      descriptionEmphasis: 'personal',
      descriptionAfter: ' pentru cineva drag.',
      collectionAction: 'Descoperă jucăriile',
      howAction: 'Cum funcționează',
      note: 'Nu de pe raft.',
      noteStrong: 'Făcut cu drag, pentru tine.',
      imageLabel: 'un mic dar, cu mult drag',
      imagePlaceholder: 'Loc rezervat pentru fotografia creațiilor Snuggle Stitches.',
      giftLabel: 'pentru tine',
      stickerFirst: 'create cu',
      stickerSecond: 'multă iubire.',
      stickerTiny: 'LUCRATE MANUAL',
      annotation: 'O îmbrățișare de păstrat.',
      imageCredit: 'Fotografie de inspirație:',
    },
    ribbon: { label: 'Lucrate manual, dăruite cu drag, un strop din tine', phrases: ['Lucrat cu grijă', 'Dăruit cu drag', 'Un strop din tine', 'Mereu special'] },
    collection: {
      eyebrow: 'GAȘCA NOASTRĂ MICĂ',
      titleFirst: 'Noul tău', titleSecond: 'prieten drag.',
      descriptionFirst: 'Unii au urechi lungi. Alții aduc puțină magie de sezon.',
      descriptionSecond: 'Fiecare are o poveste și un strop de personalitate.',
      filterLabel: 'Filtrează colecția',
      filters: { all: 'Toate', animals: 'Animăluțe', seasonal: 'De sezon' },
      designAction: 'Descoperă',
      priceQualifier: 'în funcție de mărime',
      loading: 'Se încarcă modelele...',
      loadError: 'Colecția nu a putut fi încărcată. Verifică conexiunea și încearcă din nou.',
      retry: 'Încearcă din nou',
      emptyTitle: 'Pregătim primele modele.',
      emptyMessage: 'Revino în curând pentru a descoperi creațiile Snuggle Stitches.',
      count: (count) => `${count} ${count === 1 ? 'model afișat' : 'modele afișate'}`,
      animalLabel: 'UN MIC PRIETEN PENTRU ORICE ZI',
      seasonalLabel: 'UN STROP DE MAGIE DE SEZON',
      closerLook: 'Privește mai atent',
      note: 'Prețul final și disponibilitatea se confirmă direct, înainte de realizarea comenzii.',
    },
    personalize: {
      eyebrow: 'UN STROP MAI PERSONAL',
      artLabel: 'O PALETĂ DE POSIBILITĂȚI',
      artFirst: 'culoarea lor preferată.',
      artSecond: 'un detaliu ales de tine.',
      nameTag: 'făcut pentru',
      nameTagRecipient: 'cineva drag',
      note: 'Lucrurile mici contează.',
      titleFirst: 'Același prieten drag.',
      titleSecond: 'Numai al tău.',
      description: 'Culoarea preferată. Un fular micuț. Un mesaj care spune exact ce trebuie. Cele mai mici detalii pot face cadourile cele mai dragi.',
      touches: ['Culorile preferate', 'Fundițe și fulare', 'Etichetă și mesaj cadou', 'Mărimea dorită', 'Inspirat de un model drag', 'Ideile tale'],
      action: 'Spune-mi ce ai în minte',
      disclaimer: 'Idei pe care le putem discuta, nu un configurator online.',
    },
    steps: {
      eyebrow: 'DE LA O IDEE MICĂ LA UN PRIETEN DRAG',
      titleFirst: 'Lucrurile frumoase',
      titleSecond: 'cer câteva ochiuri.',
      intro: 'Fără coș de cumpărături. Doar o discuție și ceva lucrat cu grijă.',
      items: [
        { title: 'Alege-ți preferatul', description: 'Răsfoiește colecția și alege modelul care îți aduce un zâmbet.' },
        { title: 'Hai să-l personalizăm', description: 'Vorbim despre culori, mărime și acele detalii alese cu drag, pe Instagram sau TikTok.' },
        { title: 'Începem să-l lucrăm', description: 'Stabilim împreună detaliile, prețul și timpul necesar înainte să încep lucrul.' },
      ],
    },
    story: {
      eyebrow: 'BUNĂ, DE LA CELĂLALT CAPĂT AL FIRULUI',
      imagePlaceholder: 'Loc rezervat pentru o fotografie din atelierul Snuggle Stitches.',
      titleFirst: 'Îmi place să', titleSecond: 'aduc zâmbete.',
      paragraphs: [
        'Eu sunt persoana din spatele Snuggle Stitches. Ideea e simplă: puțin fir și un detaliu ales cu drag se pot transforma într-un cadou cu adevărat personal.',
        'De la animăluțe îndrăgite la mici surprize de sezon, aici explorăm împreună ce am putea crea. Ceva moale, special și numai bun de dăruit.',
      ],
      signature: 'Cu drag, Snuggle Stitches',
    },
    contact: {
      eyebrow: 'PENTRU CINEVA DRAG',
      titleFirst: 'Ai o idee?',
      titleSecond: 'Hai s-o transformăm în ceva frumos.',
      description: 'Ai găsit un prieten drag sau ți-ai imaginat unul al tău?',
      instagram: 'Scrie-mi pe Instagram',
      tiktok: 'Urmărește-mă pe TikTok',
      demoDisclaimer: 'Conturile Snuggle Stitches sunt la un singur click distanță.',
      modalEyebrow: 'O DISCUȚIE E UN ÎNCEPUT FRUMOS',
      modalTitle: 'Hai să facem o bucurie.',
      modalDescription: 'Alege profilul pe care îl preferi. Linkul deschide contul Snuggle Stitches într-o filă nouă. Mesajul și comanda se discută direct cu persoana care le creează.',
      profilePrompt: 'Deschide un profil și scrie-mi',
      messageLabel: 'UN MESAJ CU CARE POȚI ÎNCEPE',
      genericMessage: 'Bună! Aș vrea să discut despre un cadou croșetat și personalizat. Putem vorbi despre modele, culori și mărimi?',
      messagePrefix: 'Bună! Îmi place modelul',
      messageSuffix: 'și aș vrea să discutăm despre o variantă personalizată, pentru un cadou. Putem vorbi despre culori, mărime și detalii?',
      instagramProfile: 'Profilul Snuggle Stitches pe Instagram (se deschide într-o filă nouă)',
      tiktokProfile: 'Profilul Snuggle Stitches pe TikTok (se deschide într-o filă nouă)',
      returnTo: 'Înapoi la',
    },
    footer: { tagline: 'Detalii mici. Bucurii mari.', concept: 'Concept showcase' },
    details: {
      inspiration: 'Model de inspirație',
      priceDepending: 'Prețul final și detaliile se stabilesc împreună, în funcție de mărime.',
      title: 'Îl facem al tău?',
      contactAction: 'Hai să vorbim despre model',
      note: 'Acesta este un punct de pornire pentru o discuție, nu o comandă. Disponibilitatea și detaliile se stabilesc împreună.',
    },
  },
}
