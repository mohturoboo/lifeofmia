import type { Locale } from '@/i18n/config';
import { fromDateKey, type DateKey } from '@/lib/date';

/**
 * Citation du jour.
 *
 * Le choix est deterministe : il depend de la date et de l'identifiant de
 * l'utilisateur. Deux consequences utiles — la citation ne change pas si la
 * page est rechargee, et deux utilisateurs ne voient pas la meme le meme jour.
 */

interface Quote {
  author: string;
  text: Record<Locale, string>;
}

const QUOTES: Quote[] = [
  {
    author: 'Aristote',
    text: {
      fr: "Nous sommes ce que nous faisons de manière répétée. L'excellence n'est donc pas un acte, mais une habitude.",
      en: 'We are what we repeatedly do. Excellence, then, is not an act, but a habit.',
      ar: 'نحن ما نفعله بشكل متكرر. لذا فإن التميز ليس فعلاً بل عادة.',
      es: 'Somos lo que hacemos repetidamente. La excelencia no es un acto, sino un hábito.',
      de: 'Wir sind, was wir wiederholt tun. Exzellenz ist daher keine Tat, sondern eine Gewohnheit.',
      it: 'Siamo ciò che facciamo ripetutamente. L\'eccellenza non è un atto, ma un\'abitudine.',
      pt: 'Somos o que fazemos repetidamente. A excelência não é um ato, mas um hábito.',
      tr: 'Biz tekrar tekrar yaptığımız şeyleriz. O hâlde mükemmellik bir eylem değil, bir alışkanlıktır.',
    },
  },
  {
    author: 'Lao Tseu',
    text: {
      fr: 'Un voyage de mille lieues commence toujours par un premier pas.',
      en: 'A journey of a thousand miles begins with a single step.',
      ar: 'رحلة الألف ميل تبدأ بخطوة واحدة.',
      es: 'Un viaje de mil millas comienza con un solo paso.',
      de: 'Eine Reise von tausend Meilen beginnt mit einem einzigen Schritt.',
      it: 'Un viaggio di mille miglia inizia con un solo passo.',
      pt: 'Uma jornada de mil milhas começa com um único passo.',
      tr: 'Bin millik bir yolculuk tek bir adımla başlar.',
    },
  },
  {
    author: 'Sénèque',
    text: {
      fr: "Ce n'est pas parce que les choses sont difficiles que nous n'osons pas, c'est parce que nous n'osons pas qu'elles sont difficiles.",
      en: 'It is not because things are difficult that we do not dare; it is because we do not dare that they are difficult.',
      ar: 'ليس لأن الأمور صعبة لا نجرؤ، بل لأننا لا نجرؤ تكون صعبة.',
      es: 'No nos atrevemos a muchas cosas porque son difíciles, pero son difíciles porque no nos atrevemos.',
      de: 'Nicht weil es schwer ist, wagen wir es nicht, sondern weil wir es nicht wagen, ist es schwer.',
      it: 'Non è perché le cose sono difficili che non osiamo, è perché non osiamo che sono difficili.',
      pt: 'Não é porque as coisas são difíceis que não ousamos; é porque não ousamos que elas são difíceis.',
      tr: 'Zor olduğu için cesaret edemiyor değiliz; cesaret edemediğimiz için zor.',
    },
  },
  {
    author: 'James Clear',
    text: {
      fr: "Vous ne vous élevez pas au niveau de vos objectifs, vous retombez au niveau de vos systèmes.",
      en: 'You do not rise to the level of your goals. You fall to the level of your systems.',
      ar: 'أنت لا ترتقي إلى مستوى أهدافك، بل تسقط إلى مستوى أنظمتك.',
      es: 'No te elevas al nivel de tus metas, caes al nivel de tus sistemas.',
      de: 'Du steigst nicht auf das Niveau deiner Ziele, du fällst auf das Niveau deiner Systeme.',
      it: 'Non sali al livello dei tuoi obiettivi, scendi al livello dei tuoi sistemi.',
      pt: 'Você não se eleva ao nível dos seus objetivos, você cai ao nível dos seus sistemas.',
      tr: 'Hedeflerinizin seviyesine yükselmezsiniz, sistemlerinizin seviyesine düşersiniz.',
    },
  },
  {
    author: 'Marc Aurèle',
    text: {
      fr: 'La qualité de votre vie dépend de la qualité de vos pensées.',
      en: 'The quality of your life depends on the quality of your thoughts.',
      ar: 'جودة حياتك تعتمد على جودة أفكارك.',
      es: 'La calidad de tu vida depende de la calidad de tus pensamientos.',
      de: 'Die Qualität deines Lebens hängt von der Qualität deiner Gedanken ab.',
      it: 'La qualità della tua vita dipende dalla qualità dei tuoi pensieri.',
      pt: 'A qualidade da sua vida depende da qualidade dos seus pensamentos.',
      tr: 'Hayatınızın kalitesi düşüncelerinizin kalitesine bağlıdır.',
    },
  },
  {
    author: 'Confucius',
    text: {
      fr: "Peu importe la lenteur à laquelle vous avancez, tant que vous ne vous arrêtez pas.",
      en: 'It does not matter how slowly you go, as long as you do not stop.',
      ar: 'لا يهم مدى بطء تقدمك، طالما أنك لا تتوقف.',
      es: 'No importa lo lento que vayas, mientras no te detengas.',
      de: 'Es spielt keine Rolle, wie langsam du gehst, solange du nicht stehen bleibst.',
      it: 'Non importa quanto lentamente vai, purché tu non ti fermi.',
      pt: 'Não importa o quão devagar você vá, desde que não pare.',
      tr: 'Ne kadar yavaş gittiğiniz önemli değil, yeter ki durmayın.',
    },
  },
  {
    author: 'Will Durant',
    text: {
      fr: "La discipline est le pont entre les objectifs et les accomplissements.",
      en: 'Discipline is the bridge between goals and accomplishment.',
      ar: 'الانضباط هو الجسر بين الأهداف والإنجاز.',
      es: 'La disciplina es el puente entre las metas y los logros.',
      de: 'Disziplin ist die Brücke zwischen Zielen und Erfolg.',
      it: 'La disciplina è il ponte tra gli obiettivi e i risultati.',
      pt: 'A disciplina é a ponte entre objetivos e realizações.',
      tr: 'Disiplin, hedefler ile başarı arasındaki köprüdür.',
    },
  },
  {
    author: 'Antoine de Saint-Exupéry',
    text: {
      fr: "Un objectif sans plan n'est qu'un souhait.",
      en: 'A goal without a plan is just a wish.',
      ar: 'الهدف بلا خطة مجرد أمنية.',
      es: 'Una meta sin un plan es solo un deseo.',
      de: 'Ein Ziel ohne Plan ist nur ein Wunsch.',
      it: 'Un obiettivo senza un piano è solo un desiderio.',
      pt: 'Um objetivo sem um plano é apenas um desejo.',
      tr: 'Planı olmayan bir hedef sadece bir dilektir.',
    },
  },
  {
    author: 'Proverbe',
    text: {
      fr: "Le meilleur moment pour planter un arbre était il y a vingt ans. Le deuxième meilleur moment, c'est maintenant.",
      en: 'The best time to plant a tree was twenty years ago. The second best time is now.',
      ar: 'أفضل وقت لزراعة شجرة كان قبل عشرين عاماً. وثاني أفضل وقت هو الآن.',
      es: 'El mejor momento para plantar un árbol fue hace veinte años. El segundo mejor momento es ahora.',
      de: 'Die beste Zeit, einen Baum zu pflanzen, war vor zwanzig Jahren. Die zweitbeste ist jetzt.',
      it: 'Il momento migliore per piantare un albero era vent\'anni fa. Il secondo momento migliore è adesso.',
      pt: 'O melhor momento para plantar uma árvore foi há vinte anos. O segundo melhor momento é agora.',
      tr: 'Bir ağaç dikmek için en iyi zaman yirmi yıl önceydi. İkinci en iyi zaman ise şimdi.',
    },
  },
  {
    author: 'Jim Rohn',
    text: {
      fr: 'Prenez soin de votre corps. C\'est le seul endroit où vous êtes obligé de vivre.',
      en: 'Take care of your body. It is the only place you have to live.',
      ar: 'اعتنِ بجسدك، فهو المكان الوحيد الذي تعيش فيه.',
      es: 'Cuida tu cuerpo. Es el único lugar donde tienes que vivir.',
      de: 'Kümmere dich um deinen Körper. Er ist der einzige Ort, an dem du leben musst.',
      it: 'Prenditi cura del tuo corpo. È l\'unico posto in cui devi vivere.',
      pt: 'Cuide do seu corpo. É o único lugar onde você tem de viver.',
      tr: 'Bedeninize iyi bakın. Yaşamak zorunda olduğunuz tek yer orası.',
    },
  },
  {
    author: 'Peter Drucker',
    text: {
      fr: 'Ce qui se mesure s\'améliore.',
      en: 'What gets measured gets improved.',
      ar: 'ما يُقاس يتحسن.',
      es: 'Lo que se mide, mejora.',
      de: 'Was gemessen wird, wird verbessert.',
      it: 'Ciò che viene misurato viene migliorato.',
      pt: 'O que é medido é melhorado.',
      tr: 'Ölçülen şey gelişir.',
    },
  },
  {
    author: 'Nelson Mandela',
    text: {
      fr: 'Cela semble toujours impossible, jusqu\'à ce qu\'on le fasse.',
      en: 'It always seems impossible until it is done.',
      ar: 'يبدو الأمر مستحيلاً دائماً حتى يتم إنجازه.',
      es: 'Siempre parece imposible hasta que se hace.',
      de: 'Es scheint immer unmöglich, bis es getan ist.',
      it: 'Sembra sempre impossibile finché non viene fatto.',
      pt: 'Parece sempre impossível até que seja feito.',
      tr: 'Yapılana kadar her şey imkânsız görünür.',
    },
  },
];

/** Hachage stable (FNV-1a) : meme entree, meme sortie, sans dependance. */
function hash(input: string): number {
  let value = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    value ^= input.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return Math.abs(value);
}

export function quoteOfTheDay(
  date: DateKey,
  locale: Locale,
  userId = '',
): { text: string; author: string } {
  const dayNumber = Math.floor(fromDateKey(date).getTime() / 86_400_000);
  const index = (dayNumber + hash(userId)) % QUOTES.length;
  const quote = QUOTES[index];
  return { text: quote.text[locale] ?? quote.text.en, author: quote.author };
}

export const quoteCount = QUOTES.length;
